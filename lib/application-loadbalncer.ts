import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";


interface AlbStackProps{
    vpc : ec2.Vpc,
}

export class ApplicationLoadBalancerStack extends Stack{
    public readonly alb : elbv2.ApplicationLoadBalancer;
    constructor(scope: Construct, id:string, props: AlbStackProps){
        super(scope,id);

        const albSG = new ec2.SecurityGroup(this,'albSG',{
            vpc: props.vpc,
            description: 'Security group for the application load balancer',
            allowAllOutbound: true
        });
        albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic from anywhere');
        
        //APPLICATION LOAD BALANCER
        this.alb = new elbv2.ApplicationLoadBalancer(this,'ApplicationLoadBalancer',{
            vpc: props.vpc,
            internetFacing: true,
            securityGroup: albSG,  
        });
    


    }

    }

