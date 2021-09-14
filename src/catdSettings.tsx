import Q = require("q");
import Controls = require("VSS/Controls");
import {Combo, IComboOptions} from "VSS/Controls/Combos";
import Menus = require("VSS/Controls/Menus");
import WIT_Client = require("TFS/WorkItemTracking/RestClient");
import Contracts = require("TFS/WorkItemTracking/Contracts");
import Utils_string = require("VSS/Utils/String");

import { StoredFieldReferences } from "./catdModels";

export class Settings {
    private _changeMade = false;
    private _selectedFields:StoredFieldReferences;
    private _fields:Contracts.WorkItemField[];
    private _menuBar = null;

    private getSortedDateTimeFieldsList():IPromise<any> {
        var deferred = Q.defer();
        var client = WIT_Client.getClient();
        client.getFields().then((fields: Contracts.WorkItemField[]) => {
            this._fields = fields.filter(field => (field.type === Contracts.FieldType.DateTime))
            var sortedFields = this._fields.map(field => field.name).sort((field1,field2) => {
                if (field1 > field2) {
                    return 1;
                }

                if (field1 < field2) {
                    return -1;
                }

                return 0;
            });
            deferred.resolve(sortedFields);
        });

        return deferred.promise;
    }

    private getSortedDecimalFieldsList():IPromise<any> {
        var deferred = Q.defer();
        var client = WIT_Client.getClient();
        client.getFields().then((fields: Contracts.WorkItemField[]) => {
            this._fields = fields.filter(field => (field.type === Contracts.FieldType.Integer))
            var sortedFields = this._fields.map(field => field.name).sort((field1,field2) => {
                if (field1 > field2) {
                    return 1;
                }

                if (field1 < field2) {
                    return -1;
                }

                return 0;
            });
            deferred.resolve(sortedFields);
        });

        return deferred.promise;
    }

    private getFieldReferenceName(fieldName): string {
        let matchingFields = this._fields.filter(field => field.name === fieldName);
        return (matchingFields.length > 0) ? matchingFields[0].referenceName : null;
    }

    private getFieldName(fieldReferenceName): string {
        let matchingFields = this._fields.filter(field => field.referenceName === fieldReferenceName);
        return (matchingFields.length > 0) ? matchingFields[0].name : null;
    }

    private getComboOptions(id, fieldsList, initialField):IComboOptions {
        var that = this;
        return {
            id: id,
            mode: "drop",
            source: fieldsList,
            enabled: true,
            value: that.getFieldName(initialField),
            change: function () {
                that._changeMade = true;
                let fieldName = this.getText();
                let fieldReferenceName: string = (this.getSelectedIndex() < 0) ? null : that.getFieldReferenceName(fieldName);

                switch (this._id) {
                    case "startDate":
                        that._selectedFields.sdField = fieldReferenceName;
                        break;
                    case "estWorkingDay":
                        that._selectedFields.estField = fieldReferenceName;
                        break;
                    case "targetDate":
                        that._selectedFields.tdField = fieldReferenceName;
                        break;
                }
                that.updateSaveButton();
            }
        };
    }

    public initialize() {
        let hubContent = $(".hub-content");
        let uri = VSS.getWebContext().collection.uri + "_admin/_process";
        
        let descriptionText = "CaTD is a tool to auto calculate Target Date by adding Est Working Day Field to Start Date Field.";
        let header = $("<div />").addClass("description-text bowtie").appendTo(hubContent);
        header = $("<div />").addClass("description-text bowtie").appendTo(hubContent);
        header.html(Utils_string.format(descriptionText));
        
        descriptionText = "You must add a custom decimal field from the {0} to each work item type you wish to compute Target Date.";
        header = $("<div />").addClass("description-text bowtie").appendTo(hubContent);
        header.html(Utils_string.format(descriptionText, "<a target='_blank' href='" + uri +"'>process hub</a>"));

        let container = $("<div />").addClass("catd-settings-container").appendTo(hubContent);

        var menubarOptions = {
            items: [
                { id: "save", icon: "icon-save", title: "Save the selected field" }   
            ],
            executeAction:(args) => {
                var command = args.get_commandName();
                switch (command) {
                    case "save":
                        this.save();
                        break;
                    default:
                        console.log("Unhandled action: " + command);
                        break;
                }
            }
        };
        this._menuBar = Controls.create<Menus.MenuBar, any>(Menus.MenuBar, container, menubarOptions);

        let sdContainer = $("<div />").addClass("settings-control").appendTo(container);
        $("<label />").text("Start Date Field").appendTo(sdContainer);

        let estContainer = $("<div />").addClass("settings-control").appendTo(container);
        $("<label />").text("EST Working Day Field").appendTo(estContainer);

        let tdContainer = $("<div />").addClass("settings-control").appendTo(container);
        $("<label />").text("Target Field Field").appendTo(tdContainer);


        VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then((dataService: IExtensionDataService) => {
            dataService.getValue<StoredFieldReferences>("storedFields").then((storedFields:StoredFieldReferences) => {
                if (storedFields) {
                    console.log("Retrieved fields from storage");
                    this._selectedFields = storedFields;
                }
                else {
                    console.log("Failed to retrieve fields from storage, defaulting values")
					//Enter in your config referenceName for "rvField" and "wsjfField"
                    this._selectedFields = {
                        sdField: "Microsoft.VSTS.Scheduling.StartDate",
                        estField: null,
                        tdField: 'Microsoft.VSTS.Scheduling.TargetDate'
                    };
                }

                this.getSortedDateTimeFieldsList().then((fieldList) => {
                    Controls.create(Combo, sdContainer, this.getComboOptions("startDate", fieldList, this._selectedFields.sdField));
                    Controls.create(Combo, tdContainer, this.getComboOptions("targetDate", fieldList, this._selectedFields.tdField));
                    
                    this.getSortedDecimalFieldsList().then((fieldList) =>{
                        Controls.create(Combo, estContainer, this.getComboOptions("estWorkingDay", fieldList, this._selectedFields.estField));
                        //this.updateSaveButton();
                        VSS.notifyLoadSucceeded();
                    });
                });
            });
        });  
    }

    private save() {
        VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData).then((dataService: IExtensionDataService) => {
            dataService.setValue<StoredFieldReferences>("storedFields", this._selectedFields).then((storedFields:StoredFieldReferences) => {
                console.log("Storing fields completed");
                this._changeMade = false;
                this.updateSaveButton();
            });
        });
    } 

    private updateSaveButton() {
        var buttonState = (this._selectedFields.sdField && this._selectedFields.tdField && this._selectedFields.estField) && this._changeMade
                            ? Menus.MenuItemState.None : Menus.MenuItemState.Disabled;

        // Update the disabled state
        this._menuBar.updateCommandStates([
            { id: "save", disabled: buttonState },
        ]);
    }
}