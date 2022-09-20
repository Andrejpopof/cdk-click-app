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


const app = new cdk.App();


const vpcStack = new VpcStack(app, 'VpcStack-1', {
 
});

const pipelineStack = new PipelineStack(app, 'PipelineStack-5',{
  
});

const applicationLoadBalancer = new ApplicationLoadBalancerStack(app, 'AppLoadbalancerStack-2',{
  vpc: vpcStack.network.myVpc
});

const nlbStack  = new NetworkLoadBalancerStack(app, 'NetLoadbalancerStack-3',{
  vpc: vpcStack.network.myVpc
});

const clusterStack = new ClusterStack(app, 'ClusterStack-4',{
  vpc: vpcStack.network.myVpc,
  applicationLoadbalancer: applicationLoadBalancer.alb,
  networkLoadbalancer: nlbStack.networkLoadBalancer,
  networkLoadbalancerTG: nlbStack.networkLoadBalancerTG
});
