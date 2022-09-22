import { Construct } from "constructs";
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { EcrImage, LogDriver, PropagatedTagSource } from "aws-cdk-lib/aws-ecs";
import {Network} from './vpc-component';
import { aws_logs, CfnOutput, Duration, Fn, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Port, Protocol, SubnetType } from "aws-cdk-lib/aws-ec2";
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ListenerAction } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { TargetTrackingScalingPolicy } from "aws-cdk-lib/aws-applicationautoscaling";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";



interface ClusterStackProps extends StackProps{
    vpc : ec2.Vpc,
    applicationLoadbalancer: elbv2.ApplicationLoadBalancer,
    networkLoadbalancer: elbv2.NetworkLoadBalancer,
    networkLoadbalancerTG: elbv2.NetworkTargetGroup
}


export class ClusterStack extends Stack {
    public readonly cluster : ecs.Cluster;
    public readonly frontendRepo: ecr.IRepository;
    public readonly containerLogGroup: LogGroup;
    public readonly databaseContainerService: ecs.FargateService;

    constructor(scope: Construct, id: string, props: ClusterStackProps){
        super(scope,id);

    this.cluster = new ecs.Cluster(this,'myCluster', {
        vpc: props.vpc
    });


    //LOG GROUP FOR ALL THE CONTAINERS
    const containerLogGroup = new LogGroup(this, 'ContainerLogGroup',{removalPolicy: RemovalPolicy.RETAIN , retention: RetentionDays.ONE_MONTH})

   
    //DATABASE

    // DATABASE TASKDEFINITION
    const databaseTaskDefinition = new ecs.FargateTaskDefinition(this,'databaseTaskDef',{
        cpu: 256,
        memoryLimitMiB: 512,

    });

    //DATABASE CONTAINER
    const databaseContainer = databaseTaskDefinition.addContainer('databaseContainer',{
        image: ecs.ContainerImage.fromRegistry('mongo'),
        environment:{                           //MOZE I ENV FILE da se iskoristi, isto moze i secrets
            MONGO_INITDB_DATABASE: 'mongo',
            MONGO_INITDB_ROOT_USERNAME: 'admin',
            MONGO_INITDB_ROOT_PASSWORD: 'pass'
        },
        logging: LogDriver.awsLogs({streamPrefix: 'database-', logGroup: containerLogGroup}) 
    });

    const databasePortMapping = databaseContainer.addPortMappings(
        {
            containerPort: 27017,
            protocol: ecs.Protocol.TCP
        }
    );
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'databaseSecurityGroup',{
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security group for database'
    });
    databaseSecurityGroup.addIngressRule(ec2.Peer.ipv4('10.0.0.0/20'),ec2.Port.allTraffic(),'Allow inbound traffic from every resource in the network')

    //DATABASE SERVICE
    const databaseContainerService = new ecs.FargateService(this,'databaseService',{
        cluster: this.cluster,
        taskDefinition: databaseTaskDefinition,
        assignPublicIp: true,
        desiredCount: 1,
        vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
        securityGroups: [databaseSecurityGroup]

    });
    databaseContainerService.attachToNetworkTargetGroup(props.networkLoadbalancerTG);

    // const repository = new ecr.Repository(this, "sd-conf-aggr", {
    //     repositoryName: "sd-conf-ident-aggr"
    //   });

    //OUTPUTS
    
    new CfnOutput(this,'ALB',{
        description: 'DNS for the Application Loadbalancer',
        value: props.applicationLoadbalancer.loadBalancerDnsName
    });

    new CfnOutput(this, 'BackendEndpoint',{
        description: 'Backend endpoint',
        value: 'http://' + props.applicationLoadbalancer.loadBalancerDnsName + '/api'
    });
    


    }
}