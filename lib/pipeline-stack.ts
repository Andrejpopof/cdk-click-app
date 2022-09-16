// import { Stack } from "aws-cdk-lib";
// import { CdkCommand } from "aws-cdk-lib/cloud-assembly-schema";
// import { Construct } from "constructs";
// import * as cdk from 'aws-cdk-lib';
// import { Pipeline } from "aws-cdk-lib/aws-codepipeline";
// import { GitHubSourceAction } from "aws-cdk-lib/aws-codepipeline-actions";


// export class PipelineStack extends Stack{
//     constructor(scope: Construct, id:string, props?: cdk.StackProps){
//         super(scope,id);


//         const pipeline = new cdk.aws_codepipeline.Pipeline(this, 'Pipeline',{
//             pipelineName: 'Pipeline',
//             crossAccountKeys: false,
//             restartExecutionOnUpdate: true
//         });

//         const sourceStage = pipeline.addStage({
//             stageName: 'Source',
//             actions: [
//                 new GitHubSourceAction({
//                     actionName: 'CDK_Source',
//                     owner: 'Andrejpopof',
//                     repo: ''
//                 })
//             ]
//         })


//     }
// }