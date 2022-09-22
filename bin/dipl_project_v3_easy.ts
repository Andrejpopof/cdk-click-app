#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { env } from 'process';
import { PipelineStack } from '../lib/pipeline-stack';
import { ClusterStack } from '../lib/cluster-stack';
import { VpnConnection } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancerStack } from '../lib/application-loadbalncer';
import { Network } from '../lib/vpc-component';
import { NetworkLoadBalancerStack } from '../lib/network-loadbalancer';
import { FrontendStack } from '../lib/frontend-stack';
import { BackendStack } from '../lib/backend-stack';


const app = new cdk.App();


const vpcStack = new VpcStack(app, 'VpcStack-1');
const nlbStack  = new NetworkLoadBalancerStack(app, 'NetLoadbalancerStack-3',{
  vpc: vpcStack.network.myVpc
});

const applicationLoadBalancer = new ApplicationLoadBalancerStack(app, 'AppLoadbalancerStack-2',{
  vpc: vpcStack.network.myVpc
});


const clusterStack = new ClusterStack(app, 'ClusterStack-4',{
  vpc: vpcStack.network.myVpc,
  applicationLoadbalancer: applicationLoadBalancer.alb,
  networkLoadbalancer: nlbStack.networkLoadBalancer,
  networkLoadbalancerTG: nlbStack.networkLoadBalancerTG
});

const frontendStack = new FrontendStack(app, 'FrontendStack-5', {
  applicationLoadbalancer: applicationLoadBalancer.alb,
  cluster: clusterStack.cluster,
  containerLogGroup: clusterStack.containerLogGroup
});

const backendStack = new BackendStack(app,'BackendStack-6',{
  vpc: vpcStack.network.myVpc,
  cluster: clusterStack.cluster,
  networkLoadbalancer: nlbStack.networkLoadBalancer,
  containerLogGroup: clusterStack.containerLogGroup,
  applicationLoadbalancer: applicationLoadBalancer.alb,
  frontendContainerService: frontendStack.frontendContainerService,
  databaseContainerService: clusterStack.databaseContainerService
});


const pipelineStack = new PipelineStack(app, 'PipelineStack-7',{
  frontendRepo: frontendStack.frontendRepo,
});


