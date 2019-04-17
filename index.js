const AWS = require('aws-sdk')


class AwsLatestLayerVersion {

	constructor (serverless, options) {
		this.serverless = serverless
		this.options = options
		this.provider = this.serverless.getProvider(this.serverless.service.provider.name)
		this.cache = new Map()

		const { service } = this.serverless

		if (service.provider.name === 'aws') {
			this.hooks = {
				//package, deploy
				'before:package:setupProviderConfiguration': this.layerVersionConfiguration.bind(this),
				//deploy function
				'before:package:function:package': this.layerVersionConfiguration.bind(this)
			};
		} else {
			this.serverless.cli.log(`don't support the "${ service.provider.name }" provider`)
		}
	}

	async layerVersionConfiguration () {
		const { service } = this.serverless

		for (let funcName in service.functions) {
			let funcLayers = service.functions[funcName].layers

			if (Array.isArray(funcLayers)) {
				await this.replaceLayerVersions(funcLayers)
			}

			if (service.hasOwnProperty('Resources')) {
				let logicalId = this.provider.naming.getLambdaLogicalId(funcName)
				let resourceDef = service.resources.Resources[logicalId]
				let resourceLayers = resourceDef && resourceDef.Properties && resourceDef.Properties.Layers

				if (Array.isArray(layers)) {
					await this.replaceLayerVersions(resourceLayers)
				}
			}
		}
	}

	async replaceLayerVersions (layers) {
		let layerLength = layers.length

		for (let i = 0; i < layerLength; ++i) {
			let layer = layers[i]

			if (/^(arn:aws:lambda:)([^:]+)([^\$]+):(\$LATEST$)/i.test(layer)) {
				let layerName = RegExp.$1 + RegExp.$2 + RegExp.$3
				let latestVersion = 0

				if (this.cache.has(layerName)) {
					latestVersion = this.cache.get(layerName)
				} else {
					latestVersion = await this.getLatestLayerVersion(RegExp.$2, layerName)
					this.cache.set(layerName, latestVersion)
				}

				let layerArn = layerName + ':' + latestVersion
				layers[i] = layerArn
				this.serverless.cli.log(layerArn)
			}
		}
	}

	async getLatestLayerVersion (region, layerName) {
		const lambda = new AWS.Lambda({
			apiVersion: '2015-03-31',
			region: region
		})

		const versions = []

		try {
			const { LayerVersions } = await lambda.listLayerVersions({
				LayerName: layerName
			}).promise()

			versions.push(...LayerVersions.map((layer) => layer.Version))
			return Math.max(...versions)
		} catch (err) {
			this.serverless.cli.log(err)
		}
	}
}

module.exports = AwsLatestLayerVersion