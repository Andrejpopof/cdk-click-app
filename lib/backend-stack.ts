import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { ApplicationLoadBalancedFargateService, ApplicationLoadBalancedFargateServiceProps } from "aws-cdk-lib/aws-ecs-patterns";


interface BackendStackProps extends StackProps{
    networkLoadbalancer : elbv2.NetworkLoadBalancer,
    containerLogGroup: LogGroup,
    vpc: ec2.Vpc,
    cluster: ecs.Cluster,
    applicationLoadbalancer: elbv2.ApplicationLoadBalancer,
    frontendContainerService: ApplicationLoadBalancedFargateService,
    databaseContainerService: ecs.FargateService
}

export class BackendStack extends Stack{
    constructor(scope: Construct, id: string, props: BackendStackProps){
        super(scope,id);

        //BACKEND 
const backendTaskDefinition = new ecs.FargateTaskDefinition(this, 'backendTaskDef', {
    cpu: 256,
    memoryLimitMiB: 512
});

const backendRepo =  ecr.Repository.fromRepositoryName(this,'backendRepo','backend');
const backendContainer = backendTaskDefinition.addContainer('backendContainer',{
    image: ecs.EcrImage.fromEcrRepository(backendRepo),
    environment:{
        MONGODB_HOST: props.networkLoadbalancer.loadBalancerDnsName,
        MONGODB_USER: 'admin',
        MONGODB_PASSWORD: 'pass',
        FLASK_ENV: 'production',
        BACKEND_PORT: '8080',
        MONGODB_PORT: '27017',
        MONGODB_NAME: 'interns',
        SCRIPT_NAME: '/api',
    },
    logging: ecs.LogDriver.awsLogs({streamPrefix: 'backend- ', logGroup: props.containerLogGroup})
});

const backendContainerPortMapping = backendContainer.addPortMappings({containerPort: 8080 , protocol: ecs.Protocol.TCP});

const backendSecurityGroup = new ec2.SecurityGroup(this,'backendSecurityGroup',{
    vpc: props.vpc,
    allowAllOutbound: true,
    description: 'Security Group for the backend service'
});
backendSecurityGroup.connections.allowFrom(props.applicationLoadbalancer,ec2.Port.allTraffic(),'allow incoming traffic from the application load balancer')

const backendFargateService = new ecs.FargateService(this,'backendFargateService', {
    cluster: props.cluster,
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
    listener: props.frontendContainerService.listener,
    priority: 10,
    conditions:[
        elbv2.ListenerCondition.pathPatterns(['/api'])
    ],
    action: elbv2.ListenerAction.forward([backendTG])
});

//backendFargateService.node.addDependency(props.databaseContainerService);
    }
}




