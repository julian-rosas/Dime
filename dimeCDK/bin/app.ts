#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DimeStack } from "../lib/dime-stack";

const app = new cdk.App();
const stageValue = app.node.tryGetContext("stage") ?? process.env.STAGE ?? "dev";
const stage = `${stageValue}`.toLowerCase();

if (stage !== "dev" && stage !== "prod") {
  throw new Error(`Unsupported stage "${stageValue}". Use "dev" or "prod".`);
}

new DimeStack(app, `DimeStack-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  tags: {
    Project: "Dime",
    Environment: stage,
    ManagedBy: "CDK",
    Hackathon: "true",
  },
});
