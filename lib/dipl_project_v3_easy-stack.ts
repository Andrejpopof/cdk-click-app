import * as cdk from 'aws-cdk-lib';
import { Cluster } from './cluster';
import { Construct } from 'constructs';
import { Network } from './vpc';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class DiplProjectV3EasyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const network  = new Network(this,'Network',{
      maxAz: 2
    })

    const cluster = new Cluster(this,'Cluster',{
      vpc: network.myVpc
    })
  }
}
