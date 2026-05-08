#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

new WebStack(app, "BizenHealthWebProd", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-south-1",
  },
  domainName: "app.bizenhealth.com",
  hostedZoneName: "bizenhealth.com",
  githubRepo: "bizenlabs/bizen-health-web",
  githubBranch: "main",
  ecrRepoName: "bizen-health-web",
  serviceName: "bizen-health-web",
  containerPort: 3000,
  desiredCount: 1,
  cpu: 256,
  memoryMiB: 512,
});

app.synth();
