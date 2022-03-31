import * as appInsights from 'applicationinsights'
import * as azure from '@pulumi/azure'
import * as pulumi from '@pulumi/pulumi'
import workload from '../workloads/workload'
import * as automation from '@pulumi/pulumi/automation'
import * as dotenv from 'dotenv'
import { FunctionApp } from './functionApp'

dotenv.config({ path: './../.env' })

const name = pulumi.getStack()

const runtime = process.env.RUNTIME!

/*
const handler = async () => {
  // Setup application insights
  appInsights
    .setup()
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(false)
    .setSendLiveMetrics(false)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
  appInsights.defaultClient.setAutoPopulateAzureProperties(true)
  appInsights.start()

  return workload()
}
*/

const getEndpoint = async () => {
  const user = await automation.LocalWorkspace.create({}).then(ws =>
    ws.whoAmI().then(i => i.user)
  )
  const shared = new pulumi.StackReference(
    `${user}/${process.env.PULUMI_PROJECT_NAME}/shared`
  )

  const resourceGroupId = shared.requireOutput('resourceGroupId')
  const resourceGroup = azure.core.ResourceGroup.get(
    'ResourceGroup',
    resourceGroupId
  )
  const insightsId = shared.requireOutput('insightsId')
  const insights = azure.appinsights.Insights.get('Insights', insightsId)
  const resourceGroupArgs = {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location
  }

  const storageAccount = new azure.storage.Account(`${runtime}sa`, {
    ...resourceGroupArgs,

    accountKind: 'StorageV2',
    accountTier: 'Standard',
    accountReplicationType: 'LRS'
  })

  const runAsPackageContainer = new azure.storage.Container(`${runtime}-c`, {
    storageAccountName: storageAccount.name,
    containerAccessType: 'private'
  })

  var endpoint = new FunctionApp(`${runtime}`, {
    resourceGroup: resourceGroup,
    storageAccount: storageAccount,
    appInsights: insights,
    storageContainer: runAsPackageContainer,
    //path: 'azuretrigger/httpcs/bin/publish',
    version: '~6',
    runtime: runtime
  })

  return endpoint

  /*
  // HTTP trigger
  return new azure.appservice.HttpEventSubscription('HttpTrigger', {
    resourceGroup,
    location: process.env.PULUMI_AZURE_LOCATION,
    callback: handler,
    appSettings: {
      APPINSIGHTS_INSTRUMENTATIONKEY: insights.instrumentationKey
    }
  })
  */
}

const endpoint = getEndpoint().then(endpoint => endpoint)

exports.url = endpoint.then(endpoint => endpoint.url)
exports.functionAppName = endpoint.then(endpoint => endpoint.functionAppName)