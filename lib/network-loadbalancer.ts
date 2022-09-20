import { Duration, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
  
  
  
  interface NetworkLoadBalancerProps{
    vpc: ec2.Vpc
  }
  
  
  export class NetworkLoadBalancerStack extends Stack{
    public readonly networkLoadBalancer: elbv2.NetworkLoadBalancer;
    public readonly networkLoadBalancerTG: elbv2.NetworkTargetGroup;
    constructor(scope: Construct, id: string, props: NetworkLoadBalancerProps){
        super(scope,id);

//NETWORK LOADBALANCER
  this.networkLoadBalancer = new elbv2.NetworkLoadBalancer(this,'NetworkLoadBalancer',{
    vpc: props.vpc,
    deletionProtection: false, //default is false so this can be skipped
    vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }

});
//NETWORK LOADBALANCER TARGETGROUP
this.networkLoadBalancerTG = new elbv2.NetworkTargetGroup(this,'NetworkTargetGroup',{
    vpc: props.vpc,
    port: 27017,
    targetType: elbv2.TargetType.IP,
    protocol: elbv2.Protocol.TCP,
    healthCheck: {
        enabled: true,
        healthyThresholdCount: 3,
        timeout: Duration.seconds(10),
        protocol: elbv2.Protocol.TCP,
        port: '27017',
        unhealthyThresholdCount: 3,
    }  
});
// NETWORK LOADBALANCER LISTENER
const networkLBListener = new elbv2.NetworkListener(this,'NetworkLBListener',{
    port: 27017,
    protocol: elbv2.Protocol.TCP,
    loadBalancer: this.networkLoadBalancer,
    defaultAction: elbv2.NetworkListenerAction.forward([this.networkLoadBalancerTG])
});

    }
  }
  
 