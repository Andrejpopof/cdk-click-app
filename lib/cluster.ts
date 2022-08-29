import { Construct } from "constructs";
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { EcrImage, LogDriver, PropagatedTagSource } from "aws-cdk-lib/aws-ecs";
import {Network} from './vpc';
import { aws_logs, CfnOutput, Fn, RemovalPolicy } from "aws-cdk-lib";
import { Port, Protocol, SubnetType } from "aws-cdk-lib/aws-ec2";
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ListenerAction } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { TargetTrackingScalingPolicy } from "aws-cdk-lib/aws-applicationautoscaling";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";


interface ClusterProps{
    vpc : ec2.Vpc
}


export class Cluster extends Construct{
    public readonly cluster : ecs.Cluster;
    constructor(scope: Construct, id: string, props: ClusterProps){
        super(scope,id);

    this.cluster = new ecs.Cluster(this,'myCluster', {
        vpc: props.vpc
    });

    const albSG = new ec2.SecurityGroup(this,'albSG',{
        vpc: props.vpc,
        description: 'Security group for the application load balancer',
        allowAllOutbound: true
    })
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic from anywhere');

    //Treba da se dodade listener i rules i target group kade ke imame servis
    const applicationLoadBalancer = new elbv2.ApplicationLoadBalancer(this,'ApplicationLoadBalancer',{
        vpc: props.vpc,
        internetFacing: true,
        securityGroup: albSG
        
    });

    const frontendTaskDefinition = new ecs.FargateTaskDefinition(this,'frontendTaskDef',{
        cpu: 256,
        memoryLimitMiB: 2048
    });
    
    const frontendContainerLogGroup = new LogGroup(this, 'frontendContainerLogGroup',{removalPolicy: RemovalPolicy.RETAIN , retention: RetentionDays.ONE_MONTH})
    const frontendRepo = ecr.Repository.fromRepositoryName(this,'frontendString','frontend');
    const frontendCont = frontendTaskDefinition.addContainer('frontendContainer',{
        image: ecs.EcrImage.fromEcrRepository(frontendRepo),
        logging: LogDriver.awsLogs({streamPrefix: 'frontend-', logGroup: frontendContainerLogGroup})
    });

    const frontendContainerPortMapping = frontendCont.addPortMappings(
        {containerPort: 3000, protocol: ecs.Protocol.TCP}
    );

    const frontendContainerService = new ApplicationLoadBalancedFargateService(this, 'frontend',{
        cluster: this.cluster,
        cpu: 256,
        memoryLimitMiB: 512,
        assignPublicIp: true,
        desiredCount: 1,
        loadBalancer: applicationLoadBalancer,
        taskDefinition: frontendTaskDefinition,
        listenerPort: 80,
        taskSubnets: {subnetType: ec2.SubnetType.PUBLIC},
        targetProtocol: elbv2.ApplicationProtocol.HTTP
    });


    const frontendListenerRule = new elbv2.ApplicationListenerRule(this,'frontendListenerRule',{
        listener: frontendContainerService.listener,
        priority: 20,
        conditions:[ 
            elbv2.ListenerCondition.pathPatterns(['/'])
        ],
        action: elbv2.ListenerAction.forward([frontendContainerService.targetGroup])
    })


    
    new CfnOutput(this,'ALB',{
        description: 'DNS for the Application Loadbalancer',
        value: applicationLoadBalancer.loadBalancerDnsName
    })
    


    }
}