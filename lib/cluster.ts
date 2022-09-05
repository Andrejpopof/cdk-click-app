import { Construct } from "constructs";
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { EcrImage, LogDriver, PropagatedTagSource } from "aws-cdk-lib/aws-ecs";
import {Network} from './vpc';
import { aws_logs, CfnOutput, Duration, Fn, RemovalPolicy } from "aws-cdk-lib";
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


    //LOG GROUP FOR ALL THE CONTAINERS
    const containerLogGroup = new LogGroup(this, 'ContainerLogGroup',{removalPolicy: RemovalPolicy.RETAIN , retention: RetentionDays.ONE_MONTH})

    //SECURITY GROUP FOR THE APPLICATION LOAD BALANCER
    const albSG = new ec2.SecurityGroup(this,'albSG',{
        vpc: props.vpc,
        description: 'Security group for the application load balancer',
        allowAllOutbound: true
    })
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic from anywhere');

    //APPLICATION LOAD BALANCER
    const applicationLoadBalancer = new elbv2.ApplicationLoadBalancer(this,'ApplicationLoadBalancer',{
        vpc: props.vpc,
        internetFacing: true,
        securityGroup: albSG,  
    });

    //NETWORK LOADBALANCER
    const networkLoadBalancer = new elbv2.NetworkLoadBalancer(this,'NetworkLoadBalancer',{
        vpc: props.vpc,
        deletionProtection: false, //default is false so this can be skipped
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }

    });
    //NETWORK LOADBALANCER TARGETGROUP
    const networkLoadBalancerTargetGroup = new elbv2.NetworkTargetGroup(this,'NetworkTargetGroup',{
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
        loadBalancer: networkLoadBalancer,
        defaultAction: elbv2.NetworkListenerAction.forward([networkLoadBalancerTargetGroup])
    });

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
    databaseContainerService.attachToNetworkTargetGroup(networkLoadBalancerTargetGroup);



    //FRONTEND
    const frontendTaskDefinition = new ecs.FargateTaskDefinition(this,'frontendTaskDef',{
        cpu: 256,   
        memoryLimitMiB: 512
    });

    const frontendRepo = ecr.Repository.fromRepositoryName(this,'frontendString','frontend');
    const frontendCont = frontendTaskDefinition.addContainer('frontendContainer',{
        image: ecs.EcrImage.fromEcrRepository(frontendRepo),
        logging: LogDriver.awsLogs({streamPrefix: 'frontend-', logGroup: containerLogGroup})
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
        taskSubnets: {subnetType: ec2.SubnetType.PUBLIC}, // ne ni mora ova da se spcificira
        targetProtocol: elbv2.ApplicationProtocol.HTTP
    });

    const frontendListenerRule = new elbv2.ApplicationListenerRule(this,'frontendListenerRule',{
        listener: frontendContainerService.listener,
        priority: 20,
        conditions:[ 
            elbv2.ListenerCondition.pathPatterns(['/'])
        ],
        action: elbv2.ListenerAction.forward([frontendContainerService.targetGroup])
    });


    //CONF

    // const confAggrTaskDefinition = new ecs.FargateTaskDefinition(this, 'confAggrTaskDef',{
    //     cpu: 512,
    //     memoryLimitMiB: 1024
    // });


    // const confAggrRepo = ecr.Repository.fromRepositoryName(this,'confAggrRepo','sd-conf-ident-aggr');
    
    // const confAggrContainer = confAggrTaskDefinition.addContainer('confAggr',{
    //     image: ecs.ContainerImage.fromEcrRepository(confAggrRepo,'0.0.1'),
    //     logging: LogDriver.awsLogs({streamPrefix: 'confaggr-', logGroup: containerLogGroup})
    // });

    // const confAggrPortMapping = confAggrContainer.addPortMappings({ containerPort: 8080, protocol: ecs.Protocol.TCP});

    // const confAggrService = new ecs.FargateService(this,'confAggrService',{
    //     cluster: this.cluster,
    //     taskDefinition: confAggrTaskDefinition,
    //     assignPublicIp: true,
    //     desiredCount: 1,
    //     vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
    //     securityGroups: [backendSecurityGroup]
    // });


    //  const confAggrTG = new elbv2.ApplicationTargetGroup(this,'backendTG',{
    //     port: 80,
    //     vpc: props.vpc,
    //     protocol: elbv2.ApplicationProtocol.HTTP,
    //     targetType: elbv2.TargetType.IP,
    //     targets: [confAggrService]
    // });


    // const backendListenerRule = new elbv2.ApplicationListenerRule(this, 'backendListenerRule',{
    //     listener: frontendContainerService.listener,
    //     priority: 10,
    //     conditions:[
    //         elbv2.ListenerCondition.pathPatterns(['/sd-conf-ident-aggr/*'])
    //     ],
    //     action: elbv2.ListenerAction.forward([confAggrTG])
    // });

    //BACKEND 
    const backendTaskDefinition = new ecs.FargateTaskDefinition(this, 'backendTaskDef', {
        cpu: 256,
        memoryLimitMiB: 512
    });

    const backendRepo =  ecr.Repository.fromRepositoryName(this,'backendRepo','backend');
    const backendContainer = backendTaskDefinition.addContainer('backendContainer',{
        image: ecs.EcrImage.fromEcrRepository(backendRepo),
        environment:{
            MONGODB_HOST: networkLoadBalancer.loadBalancerDnsName,
            MONGODB_USER: 'admin',
            MONGODB_PASSWORD: 'pass',
            FLASK_ENV: 'production',
            BACKEND_PORT: '8080',
            MONGODB_PORT: '27017',
            MONGODB_NAME: 'interns',
            SCRIPT_NAME: '/api',
        },
        logging: LogDriver.awsLogs({streamPrefix: 'backend- ', logGroup: containerLogGroup})
    });

    const backendContainerPortMapping = backendContainer.addPortMappings({containerPort: 8080 , protocol: ecs.Protocol.TCP});

    const backendSecurityGroup = new ec2.SecurityGroup(this,'backendSecurityGroup',{
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security Group for the backend service'
    });
    backendSecurityGroup.connections.allowFrom(applicationLoadBalancer,ec2.Port.allTraffic(),'allow incoming traffic from the application load balancer')

    const backendFargateService = new ecs.FargateService(this,'backendFargateService', {
        cluster: this.cluster,
        taskDefinition: backendTaskDefinition,
        assignPublicIp: true,
        desiredCount: 1,
        vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
        securityGroups:[backendSecurityGroup]
    });

    const backendTG = new elbv2.ApplicationTargetGroup(this,'backendTG',{
        port: 80,
        vpc: props.vpc,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        targets: [backendFargateService]
    })

    const backendListenerRule = new elbv2.ApplicationListenerRule(this, 'backendListenerRule',{
        listener: frontendContainerService.listener,
        priority: 10,
        conditions:[
            elbv2.ListenerCondition.pathPatterns(['/api'])
        ],
        action: elbv2.ListenerAction.forward([backendTG])
    });

    backendFargateService.node.addDependency(databaseContainerService);

    // const repository = new ecr.Repository(this, "sd-conf-aggr", {
    //     repositoryName: "sd-conf-ident-aggr"
    //   });

    //OUTPUTS
    
    new CfnOutput(this,'ALB',{
        description: 'DNS for the Application Loadbalancer',
        value: applicationLoadBalancer.loadBalancerDnsName
    });

    new CfnOutput(this, 'BackendEndpoint',{
        description: 'Backend endpoint',
        value: 'http://' + applicationLoadBalancer.loadBalancerDnsName + '/api'
    });
    


    }
}