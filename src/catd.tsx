import Q = require("q");

import TFS_Wit_Contracts = require("TFS/WorkItemTracking/Contracts");
import TFS_Wit_Client = require("TFS/WorkItemTracking/RestClient");
import TFS_Wit_Services = require("TFS/WorkItemTracking/Services");
import moment = require("moment-business-days");

import { StoredFieldReferences } from "./catdModels";

function GetStoredFields(): IPromise<any> {
    var deferred = Q.defer();
    VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then((dataService: IExtensionDataService) => {
        dataService.getValue<StoredFieldReferences>("storedFields").then((storedFields:StoredFieldReferences) => {
            if (storedFields) {
                console.log("Retrieved fields from storage");
                deferred.resolve(storedFields);
            }
            else {
                deferred.reject("Failed to retrieve fields from storage");
            }
        });
    });
    return deferred.promise;
}

function getWorkItemFormService()
{
    return TFS_Wit_Services.WorkItemFormService.getService();
}

function updateCaTDOnForm(storedFields:StoredFieldReferences) {
    getWorkItemFormService().then((service) => {
        service.getFields().then((fields: TFS_Wit_Contracts.WorkItemField[]) => {
            var matchingStartDateFields = fields.filter(field => field.referenceName === storedFields.sdField);
            var matchingTargetDateFields = fields.filter(field => field.referenceName === storedFields.tdField);
            var matchingESTWorkingDayFields = fields.filter(field => field.referenceName === storedFields.estField);

            //If this work item type has Target Date, then update Target Date
            if ((matchingStartDateFields.length > 0) &&
                (matchingTargetDateFields.length > 0) &&
                (matchingESTWorkingDayFields.length > 0) ){
                service.getFieldValues([storedFields.sdField, storedFields.estField]).then((values) => {
                    var startDate  = +values[storedFields.sdField];
                    var estWorkingDay = +values[storedFields.estField];

                    var targetDate = 0;
                    if (estWorkingDay > 0) {
                        targetDate = moment(startDate, 'YYYY-MM-DD').businessAdd(estWorkingDay-1)._d;
                    }
                    
                    service.setFieldValue(storedFields.tdField, targetDate);
                });
            }
        });
    });
}

function updateCaTDOnGrid(workItemId, storedFields:StoredFieldReferences):IPromise<any> {
    let catdFields = [
        storedFields.sdField,
        storedFields.tdField,
        storedFields.estField
    ];

    var deferred = Q.defer();

    var client = TFS_Wit_Client.getClient();
    client.getWorkItem(workItemId, catdFields).then((workItem: TFS_Wit_Contracts.WorkItem) => {
        if (storedFields.tdField !== undefined && storedFields.estField !== undefined) {     
            var startDate = +workItem.fields[storedFields.sdField];
            var estWorkingDay = +workItem.fields[storedFields.estField];

            var targetDate = 0;
            if (estWorkingDay > 0) {
                targetDate = moment(startDate, 'YYYY-MM-DD').businessAdd(estWorkingDay-1)._d;
            }

            var document = [{
                from: null,
                op: "add",
                path: '/fields/' + storedFields.tdField,
                value: targetDate
            }];

            // Only update the work item if the targetDate has changed
            if (targetDate != workItem.fields[storedFields.tdField]) {
                client.updateWorkItem(document, workItemId).then((updatedWorkItem:TFS_Wit_Contracts.WorkItem) => {
                    deferred.resolve(updatedWorkItem);
                });
            }
            else {
                deferred.reject("No relevant change to work item");
            }
        }
        else
        {
            deferred.reject("Unable to calculate Target Date, please configure fields on the collection settings page.");
        }
    });

    return deferred.promise;
}

var formObserver = (context) => {
    return {
        onFieldChanged: function(args) {
            GetStoredFields().then((storedFields:StoredFieldReferences) => {
                if (storedFields && storedFields.sdField && storedFields.estField && storedFields.tdField) {
                    //If one of fields in the calculation changes
                    if ((args.changedFields[storedFields.sdField] !== undefined) || 
                        (args.changedFields[storedFields.estField] !== undefined)) {
                            updateCaTDOnForm(storedFields);
                        }
                }
                else {
                    console.log("Unable to calculate Target Date, please configure fields on the collection settings page.");    
                }
            }, (reason) => {
                console.log(reason);
            });
        },
        
        onLoaded: function(args) {
            GetStoredFields().then((storedFields:StoredFieldReferences) => {
                if (storedFields && storedFields.sdField && storedFields.estField && storedFields.tdField) {
                    updateCaTDOnForm(storedFields);
                }
                else {
                    console.log("Unable to calculate Target Date, please configure fields on the collection settings page.");
                }
            }, (reason) => {
                console.log(reason);
            });
        }
    } 
}

var contextProvider = (context) => {
    return {
        execute: function(args) {
            GetStoredFields().then((storedFields:StoredFieldReferences) => {
                if (storedFields && storedFields.sdField && storedFields.estField && storedFields.tdField) {
                    var workItemIds = args.workItemIds;
                    var promises = [];
                    $.each(workItemIds, function(index, workItemId) {
                        promises.push(updateCaTDOnGrid(workItemId, storedFields));
                    });

                    // Refresh view
                    Q.all(promises).then(() => {
                        VSS.getService(VSS.ServiceIds.Navigation).then((navigationService: IHostNavigationService) => {
                            navigationService.reload();
                        });
                    });
                }
                else {
                    console.log("Unable to calculate Target Date, please configure fields on the collection settings page.");
                    //TODO: Disable context menu item
                }
            }, (reason) => {
                console.log(reason);
            });
        }
    };
}

let extensionContext = VSS.getExtensionContext();
VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.catd-work-item-form-observer`, formObserver);
VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.catd-contextMenu`, contextProvider);