# **Calculate Target Date**

## **參考來源**

CaTD 主要參考自 Market Place 中的 WSJF

Market Place 連結：[https://marketplace.visualstudio.com/items?itemName=MS-Agile-SAFe.WSJF-extension](https://marketplace.visualstudio.com/items?itemName=MS-Agile-SAFe.WSJF-extension)

Github 網址：[https://github.com/microsoft/AzureDevOps-WSJF-Extension](https://github.com/microsoft/AzureDevOps-WSJF-Extension)

## **擴充功能目的**

為了可以自動計算 Target Date Field

藉由將 Start Date Field 加上 EST Working Day Field (此為自訂欄位)

## **Setup**

1. 需先自訂一個欄位紀錄 working day value，資料型別為 Decimal。這裡使用的是 EST Working Day Field。<br/>可以前往[新增和管理欄位 (繼承程式)](https://docs.microsoft.com/zh-tw/azure/devops/organizations/settings/work/customize-process-field?view=azure-devops#add-a-custom-field)參考
2. 前往有安裝此擴充功能的組織的組織設定。在 Extension 底下的 CaTD，會出現 CaTD 的欄位設定。
3. 共有三個欄位，Start Date 和 Target Date 有設定預設欄位，即 Start Date 和 Target Date。這兩個欄位也可以依據個人需求做更改。EST Working Day 需手動設定，設定為第一步驟中創建的欄位。