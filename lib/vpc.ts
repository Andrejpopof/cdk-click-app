import { Ec2Action } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Construct } from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { CfnDisk } from "aws-cdk-lib/aws-lightsail";
import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Tag, Tags } from "aws-cdk-lib";


interface NetworkProps{
    maxAz: number
}

export class Network extends Construct{
    public readonly myVpc : ec2.Vpc;
    constructor(scope: Construct, id: string, props: NetworkProps){
        super(scope,id);

        
        this.myVpc = new ec2.Vpc(this,'myVpc', {
            maxAzs: props.maxAz, //ako nemam definirano broj na azs, togas availability zones naveduvam
            cidr: '10.0.0.0/20', 
            // availabilityZones: ['eu-central-1a', 'eu-central-1b'],
            natGateways: 0,
            subnetConfiguration:[
                {
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask:26,
                    name: 'PublicSubnet'
                },
                {
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask:26,
                    name: 'IsolatedSubnet'
                }
            ]

        })
        // Tagiranje na public subnets
        for (const subnet of this.myVpc.publicSubnets){
            cdk.Aspects.of(subnet).add(new cdk.Tag(
                'Name',
                `${this.myVpc.node.id}-${subnet.node.id.replace(/Subnet[0-9]$/, '')}-${subnet.availabilityZone}`
                ))
        }
        //Tagiranje na private subnets
        for (const subnet of this.myVpc.isolatedSubnets){
            cdk.Aspects.of(subnet).add(new cdk.Tag(
                'Name',
                `${this.myVpc.node.id}-${subnet.node.id.replace(/Subnet[0-9]$/,'')}-${subnet.availabilityZone}`
            ))
        }


        

        // Koristenje na layer 1 construct 
        // new CfnOutput(this, 'albId',{exportName: 'albId', value:albSG.securityGroupId});

        
    }
    
}