import { SecretValue, Stack } from "aws-cdk-lib";
import { CdkCommand } from "aws-cdk-lib/cloud-assembly-schema";
import { Construct } from "constructs";
import * as cdk from 'aws-cdk-lib';
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { CloudFormationCreateUpdateStackAction, CodeBuildAction, EcrSourceAction, GitHubSourceAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { SECRETS_MANAGER_PARSE_OWNED_SECRET_NAME } from "aws-cdk-lib/cx-api";
import { BuildSpec, LinuxBuildImage, PipelineProject } from "aws-cdk-lib/aws-codebuild";

export class PipelineStack extends Stack{
    constructor(scope: Construct, id:string, props?: cdk.StackProps){
        super(scope,id);


        const pipeline = new cdk.aws_codepipeline.Pipeline(this, 'Pipeline',{
            pipelineName: 'Pipeline',
            crossAccountKeys: false,
            restartExecutionOnUpdate: true
        });

        const cdkSourceOutput = new Artifact('cdk-output');
        const pipelineBuildOutput = new Artifact('pipeline-build-output');
        const sourceStage = pipeline.addStage({
            stageName: 'Source',
            actions: [
                new GitHubSourceAction({
                    actionName: 'CDK_Source',
                    owner: 'Andrejpopof',
                    repo: 'cdk-click-app',
                    branch: 'main',
                    oauthToken: SecretValue.secretsManager('github-pipeline-token'),
                    output: cdkSourceOutput
                }),
                
            ]
        });

        const buildStage = pipeline.addStage({
            stageName: 'Build',
            actions: [
                new CodeBuildAction({
                    actionName: 'Pipeline_Build',
                    input: cdkSourceOutput,
                    outputs: [pipelineBuildOutput],
                    project: new PipelineProject(this, 'pipelineproject',{
                        environment:{
                            buildImage: LinuxBuildImage.STANDARD_5_0
                        },
                    buildSpec: BuildSpec.fromSourceFilename('build-specs/pipeline-build-spec.yml')
                    })
                })
            ]
        });


        const updateStackStage = pipeline.addStage({
            stageName: 'UpdateStacks',
            actions:[
            new CloudFormationCreateUpdateStackAction({
                actionName: 'Update_Pipeline',
                stackName: 'PipelineStack-5',
                adminPermissions: true,
                templatePath: pipelineBuildOutput.atPath('PipelineStack-5.template.json')
            })
            ]
        })
    }
}