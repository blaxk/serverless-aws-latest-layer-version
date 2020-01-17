# serverless-aws-latest-layer-version

Serverless plugin to support AWS Lambda Layers $LATEST tag
Returned layer version, referring to aws credentials profile.
> "--aws-profile" and "serverless.yml provider > profile" settings are all supported.

### Support hooks
- serverless deploy
- serverless deploy function
- serverless package


## Install

Install package as development dependency.

```bash
npm i serverless-aws-latest-layer-version --save-dev
```


## Setup
add the plugin to serverless.yml

```yaml
plugins:
  - serverless-aws-latest-layer-version
```

We have to replace the Layer version to $LATEST.   
`arn:aws:lambda:us-east-1:000000000000:layer:test:$LATEST`

## Changelog
#### 0.2.0
- modified to refer to aws credentials profile

&nbsp;
&nbsp;
&nbsp;

It was created with the idea of "serverless-latest-layer-version"   
