import * as cdk from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { Network } from './vpc-component';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class VpcStack extends cdk.Stack {
  public readonly network : Network;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.network  = new Network(this,'Network',{
      maxAz: 3
    })
  }
}
