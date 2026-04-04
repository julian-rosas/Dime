#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DimeStack } from "../lib/dime-stack";

const app = new cdk.App();

new DimeStack(app, "DimeStack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
    },
    tags: {
        Project: "Dime",
        Environment: "hackathon",
    },
});