import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elb from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export interface WebStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneName: string;
  githubRepo: string;
  githubBranch: string;
  ecrRepoName: string;
  serviceName: string;
  containerPort: number;
  desiredCount: number;
  cpu: number;
  memoryMiB: number;
}

export class WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const repo = new ecr.Repository(this, "Repo", {
      repositoryName: props.ecrRepoName,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [
        { description: "Keep only 10 most recent images", maxImageCount: 10 },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Public-subnet-only VPC: no NAT gateways. Fargate tasks run in public
    // subnets with public IPs, so they reach ECR/Secrets Manager/CloudWatch
    // through the Internet Gateway directly. The ALB is still the only public
    // ingress — task security group only accepts traffic from the ALB SG.
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const zone = route53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.hostedZoneName,
    });

    const cert = new acm.Certificate(this, "Cert", {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/ecs/${props.serviceName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Secrets Manager: empty shell created by CDK; values are populated by the
    // operator after `cdk deploy` (see deploy checklist). Schema below must
    // match the keys consumed by lib/env.ts.
    const appSecrets = new secretsmanager.Secret(this, "AppSecrets", {
      secretName: `${props.serviceName}/prod`,
      description: "Runtime secrets for bizen-health-web (prod)",
      secretObjectValue: {
        WORKOS_API_KEY: cdk.SecretValue.unsafePlainText("REPLACE_ME"),
        WORKOS_CLIENT_ID: cdk.SecretValue.unsafePlainText("REPLACE_ME"),
        WORKOS_COOKIE_PASSWORD: cdk.SecretValue.unsafePlainText(
          "REPLACE_ME_AT_LEAST_32_CHARS_LONG_xxxxx",
        ),
        WORKOS_WEBHOOK_SECRET: cdk.SecretValue.unsafePlainText("REPLACE_ME"),
        WORKOS_JWKS_URL: cdk.SecretValue.unsafePlainText(
          "https://api.workos.com/sso/jwks/REPLACE_ME",
        ),
        SPRING_BASE_URL: cdk.SecretValue.unsafePlainText(
          "https://api.example.invalid",
        ),
      },
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: props.cpu,
      memoryLimitMiB: props.memoryMiB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    taskDef.addContainer("app", {
      containerName: "app",
      image: ecs.ContainerImage.fromEcrRepository(repo, "latest"),
      portMappings: [{ containerPort: props.containerPort }],
      environment: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        HOSTNAME: "0.0.0.0",
        PORT: String(props.containerPort),
        NEXT_PUBLIC_APP_URL: `https://${props.domainName}`,
        WORKOS_REDIRECT_URI: `https://${props.domainName}/callback`,
        LOG_LEVEL: "info",
      },
      secrets: {
        WORKOS_API_KEY: ecs.Secret.fromSecretsManager(
          appSecrets,
          "WORKOS_API_KEY",
        ),
        WORKOS_CLIENT_ID: ecs.Secret.fromSecretsManager(
          appSecrets,
          "WORKOS_CLIENT_ID",
        ),
        WORKOS_COOKIE_PASSWORD: ecs.Secret.fromSecretsManager(
          appSecrets,
          "WORKOS_COOKIE_PASSWORD",
        ),
        WORKOS_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(
          appSecrets,
          "WORKOS_WEBHOOK_SECRET",
        ),
        WORKOS_JWKS_URL: ecs.Secret.fromSecretsManager(
          appSecrets,
          "WORKOS_JWKS_URL",
        ),
        SPRING_BASE_URL: ecs.Secret.fromSecretsManager(
          appSecrets,
          "SPRING_BASE_URL",
        ),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "app",
        logGroup,
        mode: ecs.AwsLogDriverMode.NON_BLOCKING,
      }),
    });

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "Service",
      {
        cluster,
        serviceName: props.serviceName,
        taskDefinition: taskDef,
        desiredCount: props.desiredCount,
        publicLoadBalancer: true,
        domainName: props.domainName,
        domainZone: zone,
        certificate: cert,
        protocol: elb.ApplicationProtocol.HTTPS,
        redirectHTTP: true,
        targetProtocol: elb.ApplicationProtocol.HTTP,
        listenerPort: 443,
        healthCheckGracePeriod: cdk.Duration.seconds(60),
        circuitBreaker: { rollback: true },
        minHealthyPercent: 100,
        maxHealthyPercent: 200,
        // No NAT: tasks live in public subnets and need a public IP to reach
        // ECR / Secrets Manager / CloudWatch via the Internet Gateway.
        taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        assignPublicIp: true,
      },
    );

    service.targetGroup.configureHealthCheck({
      path: "/api/health",
      healthyHttpCodes: "200",
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    const scaling = service.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(2),
      scaleOutCooldown: cdk.Duration.minutes(1),
    });

    // GitHub Actions OIDC role.
    // The provider is account-wide; use fromOpenIdConnectProviderArn if you've
    // already created one in another stack. We create it here on the assumption
    // this is a fresh account.
    const oidcProvider = new iam.OpenIdConnectProvider(this, "GitHubOIDC", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const ghRole = new iam.Role(this, "GitHubDeployRole", {
      roleName: `${props.serviceName}-gh-deploy`,
      assumedBy: new iam.FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": `repo:${props.githubRepo}:ref:refs/heads/${props.githubBranch}`,
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    repo.grantPullPush(ghRole);
    ghRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "EcrAuth",
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      }),
    );
    ghRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "EcsDescribeAndDeploy",
        actions: [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
        ],
        resources: ["*"],
      }),
    );
    ghRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "PassEcsRoles",
        actions: ["iam:PassRole"],
        resources: [
          taskDef.taskRole.roleArn,
          taskDef.executionRole?.roleArn ?? "*",
        ],
        conditions: {
          StringEquals: { "iam:PassedToService": "ecs-tasks.amazonaws.com" },
        },
      }),
    );

    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: repo.repositoryUri,
      description: "Push images to this URI",
    });
    new cdk.CfnOutput(this, "EcrRepositoryName", {
      value: repo.repositoryName,
    });
    new cdk.CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new cdk.CfnOutput(this, "ServiceName", {
      value: service.service.serviceName,
    });
    new cdk.CfnOutput(this, "TaskDefinitionFamily", {
      value: taskDef.family,
    });
    new cdk.CfnOutput(this, "AlbDnsName", {
      value: service.loadBalancer.loadBalancerDnsName,
    });
    new cdk.CfnOutput(this, "AppUrl", {
      value: `https://${props.domainName}`,
    });
    new cdk.CfnOutput(this, "AppSecretsArn", { value: appSecrets.secretArn });
    new cdk.CfnOutput(this, "GitHubDeployRoleArn", { value: ghRole.roleArn });
    new cdk.CfnOutput(this, "LogGroupName", { value: logGroup.logGroupName });
  }
}
