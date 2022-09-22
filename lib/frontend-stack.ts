import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { LogGroup } from "aws-cdk-lib/aws-logs";



interface FrontendStackProps{
    cluster: ecs.Cluster,
    containerLogGroup: LogGroup,
    applicationLoadbalancer: elbv2.ApplicationLoadBalancer
}

export class FrontendStack extends Stack{
    public readonly frontendRepo : ecr.IRepository;
    public readonly frontendContainerService: ApplicationLoadBalancedFargateService;
    constructor(scope:Construct, id:string, props:FrontendStackProps){
        super(scope,id);

        //FRONTEND
    const frontendTaskDefinition = new ecs.FargateTaskDefinition(this,'frontendTaskDef',{
        cpu: 256,   
        memoryLimitMiB: 512
    });

    this.frontendRepo = ecr.Repository.fromRepositoryName(this,'frontendString','frontend');
    const frontendCont = frontendTaskDefinition.addContainer('frontendContainer',{
        image: ecs.EcrImage.fromEcrRepository(this.frontendRepo,'latest'),
        logging: ecs.LogDriver.awsLogs({streamPrefix: 'frontend-', logGroup: props.containerLogGroup})
    });

    const frontendContainerPortMapping = frontendCont.addPortMappings(
        {containerPort: 3000, protocol: ecs.Protocol.TCP}
    );

    this.frontendContainerService = new ApplicationLoadBalancedFargateService(this, 'frontend',{
        cluster: props.cluster,
        cpu: 256,
        memoryLimitMiB: 512,
        assignPublicIp: true,
        desiredCount: 1,
        loadBalancer: props.applicationLoadbalancer,
        taskDefinition: frontendTaskDefinition,
        listenerPort: 80,
        taskSubnets: {subnetType: ec2.SubnetType.PUBLIC}, // ne ni mora ova da se spcificira
        targetProtocol: elbv2.ApplicationProtocol.HTTP
    });

    const frontendListenerRule = new elbv2.ApplicationListenerRule(this,'frontendListenerRule',{
        listener: this.frontendContainerService.listener,
        priority: 20,
        conditions:[ 
            elbv2.ListenerCondition.pathPatterns(['/'])
        ],
        action: elbv2.ListenerAction.forward([this.frontendContainerService.targetGroup])
    });


    }
    

}