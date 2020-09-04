# serverless-aws-latest-layer-version

Serverless plugin to support AWS Lambda Layers $LATEST tag.   
This replace layer version, referring to aws credentials profile.      
> "--aws-profile" and "serverless.yml provider > profile" settings are all supported.

&nbsp;

## Support hooks
- serverless deploy
- serverless deploy function
- serverless package

&nbsp;

## Install

Install package as development dependency.

```bash
npm i serverless-aws-latest-layer-version --save-dev
```

&nbsp;

## Setup
add the plugin to serverless.yml

```yaml
plugins:
  - serverless-aws-latest-layer-version
```

We have to replace the Layer version to $LATEST.   
`arn:aws:lambda:us-east-1:000000000000:layer:test:$LATEST`

&nbsp;

#### AWS credentials profile (Optional)
To specify a separate `.aws/credentials` profile alias other than `[default]`, choose one of them   
1. sls deploy `--aws-profile={profileAlias}`  
2. serverless.yml file configuration. 
```yaml
provider:
  profile: {profileAlias}
```

&nbsp;

## Changelog

#### 0.2.6
- optimize error handling

#### 0.2.5
- resource layers version bug fix

#### 0.2.4
- modified to refer to aws credentials profile

&nbsp;
&nbsp;
&nbsp;

It was created with the idea of "serverless-latest-layer-version"   
