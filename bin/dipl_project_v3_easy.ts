#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DiplProjectV3EasyStack } from '../lib/dipl_project_v3_easy-stack';
import { env } from 'process';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();


new DiplProjectV3EasyStack(app, 'DiplProjectV3EasyStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1'}
});

new PipelineStack(app, 'Pipeline',{
  env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1'}
})