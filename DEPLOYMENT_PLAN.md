# Dime Deployment Plan

## Objective

Define a simple CI/CD and environment strategy for the Dime hackathon project that supports:

- Fast iteration in `dev`
- Safe promotion to `prod`
- Coordinated changes across frontend, backend, and CDK
- Low operational overhead for a 3-day hackathon

---

## Repository Strategy

Use a single repository for the whole project.

Recommended structure:

```text
Dime/
├── dimeFrontEnd/
├── dimeBackend/
├── dimeCDK/
├── README.md
└── DEPLOYMENT_PLAN.md
```

### Why a monorepo

- Frontend, backend, and infrastructure changes are closely related
- A single PR can include all required updates
- GitHub Actions is simpler to manage
- Dev deployments can stay fast and consistent
- The CDK stacks live next to the code they deploy

### Why not separate repos

Separate repos would add coordination overhead during the hackathon:

- Cross-repo versioning
- More workflows to maintain
- Harder review and testing flow
- More friction for rapid iteration

---

## Branch Strategy

Use three branch types:

- `main`
- `develop`
- `feature/<name>`

### Purpose of each branch

- `main`
  - Represents production
  - Only stable, demo-ready code should land here

- `develop`
  - Represents development
  - Main integration branch for the team
  - Auto-deploys to the dev environment

- `feature/<name>`
  - Short-lived branches for specific tasks
  - Merged into `develop`

### Example branch names

- `feature/chat-ui`
- `feature/intent-parser`
- `feature/dev-prod-stack-config`

### Recommended flow

1. Create a `feature/...` branch
2. Open a PR into `develop`
3. Run CI checks
4. Merge into `develop`
5. Auto-deploy to `dev`
6. When stable, open PR from `develop` to `main`
7. Approve and deploy to `prod`

---

## GitHub Environments

Create two GitHub Environments:

- `dev`
- `prod`

### Recommended rules

- `dev`
  - No manual approval required
  - Fast deployment

- `prod`
  - Require manual approval
  - Restrict deployments to `main`

This gives a fast feedback loop in development and a safer production/demo flow.

---

## AWS Environment Strategy

### Recommendation

Use:

- One AWS account
- One AWS region
- Two separate environments implemented as separate stacks

Recommended region:

- `us-east-1`

### Why one region

- Less complexity
- Easier debugging
- Consistent service behavior
- Better fit for a short hackathon

### Why not multi-region

For this project, multi-region adds unnecessary complexity:

- More infrastructure to manage
- More configuration and failure modes
- No real benefit for a 3-day demo

### Why not replicas

Do not think of `dev` and `prod` as replicas.

Instead, create two logically separate environments:

- same architecture
- same region
- different stack names
- different resource names

---

## Stack Strategy

Use one stack class parameterized by `stage`.

Example stages:

- `dev`
- `prod`

### Recommended stack names

- `DimeStack-dev`
- `DimeStack-prod`

### Recommended naming prefix

- `dime-dev`
- `dime-prod`

Every environment-specific resource should include the stage in its name.

---

## AWS Resource Naming Convention

### DynamoDB

- `dime-dev-sessions`
- `dime-prod-sessions`
- `dime-dev-transactions`
- `dime-prod-transactions`

### Lambda

- `dime-dev-message-handler`
- `dime-prod-message-handler`

### API Gateway

- `dime-dev-api`
- `dime-prod-api`

### Secrets Manager

- `dime/dev/anthropic-api-key`
- `dime/prod/anthropic-api-key`

### Tags

Apply at least these tags:

- `Project=Dime`
- `Environment=dev` or `Environment=prod`
- `ManagedBy=CDK`
- `Hackathon=true`

---

## Dev vs Prod Behavior

### Dev

Purpose:

- Fast testing
- Frequent deploys
- Safe place to break and fix

Suggested characteristics:

- Automatic deploy from `develop`
- More permissive configuration if needed for speed
- Short log retention
- Destructible resources

### Prod

Purpose:

- Demo environment
- Stable release candidate

Suggested characteristics:

- Deploy only from `main`
- Manual approval before deployment
- Separate secrets
- More careful configuration

---

## GitHub Actions Workflows

Use three workflows.

### 1. CI workflow

Suggested file:

- `.github/workflows/ci.yml`

Triggers:

- Pull requests to `develop`
- Pull requests to `main`

Responsibilities:

- Checkout repository
- Setup Node.js
- Install dependencies
- Run cleanup
- Build CDK
- Run tests if available
- Run `cdk synth`

Purpose:

- Catch errors before merge
- Validate that the infrastructure still synthesizes

### 2. Dev deploy workflow

Suggested file:

- `.github/workflows/deploy-dev.yml`

Triggers:

- Push to `develop`

Responsibilities:

- Checkout repository
- Setup Node.js
- Install dependencies
- Configure AWS credentials
- Deploy CDK stack with `stage=dev`

Purpose:

- Keep dev environment always updated
- Enable fast iteration after merges

### 3. Prod deploy workflow

Suggested file:

- `.github/workflows/deploy-prod.yml`

Triggers:

- Push to `main`

Responsibilities:

- Checkout repository
- Setup Node.js
- Install dependencies
- Configure AWS credentials
- Wait for GitHub Environment approval
- Deploy CDK stack with `stage=prod`

Purpose:

- Controlled releases to the demo/production environment

---

## Recommended Deployment Flow

### Development flow

1. Developer creates `feature/...`
2. Opens PR to `develop`
3. CI runs
4. PR merges
5. GitHub Actions auto-deploys to `dev`

### Production flow

1. Team validates `dev`
2. Open PR from `develop` to `main`
3. CI runs again
4. Merge to `main`
5. GitHub Actions prepares `prod` deploy
6. Manual approval is given
7. Deployment runs to `prod`

---

## GitHub Secrets and Configuration

Use GitHub Environments for environment-specific secrets.

### `dev` environment secrets

- `AWS_REGION`
- `AWS_ROLE_ARN` or AWS access keys
- `CDK_STAGE=dev`
- `ANTHROPIC_API_KEY`

### `prod` environment secrets

- `AWS_REGION`
- `AWS_ROLE_ARN` or AWS access keys
- `CDK_STAGE=prod`
- `ANTHROPIC_API_KEY`

### Credentials recommendation

Preferred:

- GitHub OIDC + IAM Role

Fallback if needed:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

OIDC is cleaner and safer, but static keys are acceptable if time is very limited.

---

## Concurrency Recommendation

Enable workflow concurrency for deployments, especially `dev`.

This avoids wasting time and resources when several commits land quickly.

Recommended behavior:

- only the latest `develop` deployment should continue
- older in-progress `dev` deployments should be canceled

This is especially useful during hackathon iteration.

---

## Path and Scope Recommendation

Because this is a monorepo, GitHub Actions can either:

- always run the full pipeline
- or selectively run jobs depending on changed paths

### Recommendation for the hackathon

Keep it simple:

- run CI for the main project changes
- deploy when relevant app or infra paths change

Relevant paths:

- `dimeCDK/**`
- `dimeBackend/**`
- `dimeFrontEnd/**`

Do not over-optimize path filtering early unless the workflow becomes too slow.

---

## Frontend Deployment Options

There are two valid approaches.

### Option 1: Keep frontend deployment manual for now

Pros:

- Fastest setup
- Lowest risk
- Good enough if the frontend is opened locally for the demo

Cons:

- Less automated
- Frontend updates are not fully part of CI/CD

### Option 2: Host frontend in AWS too

Example:

- S3 + optional CloudFront

Environment examples:

- `dime-dev-frontend`
- `dime-prod-frontend`

Pros:

- Full end-to-end deployment automation
- Dev and prod URLs can be separated cleanly

Cons:

- More setup
- Slightly larger scope

### Hackathon recommendation

Start with backend + CDK automation first.

Only automate frontend hosting if:

- you already plan to host it in AWS
- and you have time left

---

## CDK Design Expectations

The stack should be stage-aware.

That means:

- `app.ts` passes a `stage`
- the stack uses `stage` in resource names
- outputs are environment-specific
- secrets are environment-specific

### Example deployment intent

- deploy dev using `stage=dev`
- deploy prod using `stage=prod`

### Expected outputs

Each environment should expose its own outputs, for example:

- API URL
- message endpoint
- secret name
- stage

---

## Merge and Protection Recommendations

### Recommended branch protection

For `main`:

- require pull request
- block direct pushes
- require CI checks to pass

For `develop`:

- ideally require PRs too
- if speed is more important, allow trusted direct pushes

### Minimum recommended safety

At minimum:

- protect `main`
- require approval for `prod`
- auto-deploy `develop` to `dev`

---

## Final Recommendation

Use this setup:

- One monorepo
- One AWS account
- One AWS region: `us-east-1`
- Two environments: `dev` and `prod`
- One stage-aware CDK stack class
- Two deployed stacks:
  - `DimeStack-dev`
  - `DimeStack-prod`
- Resource names prefixed by environment
- Branch flow:
  - `feature/*` -> `develop` -> `main`
- GitHub Actions workflows:
  - `ci.yml`
  - `deploy-dev.yml`
  - `deploy-prod.yml`

This gives the best balance of:

- speed
- simplicity
- cost control
- enough separation to protect the final demo

