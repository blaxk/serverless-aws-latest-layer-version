const { LambdaClient, ListLayerVersionsCommand } = require('@aws-sdk/client-lambda')
const { fromIni } = require('@aws-sdk/credential-provider-ini')
const PLUGIN_NAME = 'serverless-aws-latest-layer-version'


class AwsLatestLayerVersion {

	constructor(serverless, options) {
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
			}
		} else {
			this.error(`Don't support the "${service.provider.name}" provider`)
		}
	}

	async layerVersionConfiguration () {
		const { service } = this.serverless

		for (const funcName in service.functions) {
			const funcLayers = service.functions[funcName].layers

			if (Array.isArray(funcLayers)) {
				try {
					await this.replaceLayerVersions(funcLayers)
				} catch (err) {
					this.error(err)
					break
				}
			}

			if (service.hasOwnProperty('Resources')) {
				const logicalId = this.provider.naming.getLambdaLogicalId(funcName)
				const resourceDef = service.resources.Resources[logicalId]
				const resourceLayers = resourceDef && resourceDef.Properties && resourceDef.Properties.Layers

				if (Array.isArray(resourceLayers)) {
					try {
						await this.replaceLayerVersions(resourceLayers)
					} catch (err) {
						this.error(err)
						break
					}
				}
			}
		}

		//result log
		for (const [key, value] of this.cache.entries()) {
			this.info(`${key}:${value}`)
		}
	}

	async replaceLayerVersions (layers) {
		const layerLength = layers.length
		let error = null

		for (let i = 0; i < layerLength; ++i) {
			const layer = layers[i]
			const match = this.matchLayer(layer)

			if (match) {
				const layerName = match.layerName
				let latestVersion = 0

				if (this.cache.has(layerName)) {
					latestVersion = this.cache.get(layerName)
				} else {
					try {
						latestVersion = await this.getLatestLayerVersion(match.region, layerName)
						this.cache.set(layerName, latestVersion)
					} catch (err) {
						error = err
						break
					}
				}

				const layerArn = layerName + ':' + latestVersion
				//set layer version
				layers[i] = layerArn
			}
		}

		if (error) {
			return Promise.reject(error)
		}
	}

	async getLatestLayerVersion (region, layerName) {
		const profile = this.getProfile()
		const credentials = profile ? fromIni({ profile }) : profile
		const client = new LambdaClient({
			region,
			credentials
		})

		let error
		let result

		try {
			const { LayerVersions } = await client.send(new ListLayerVersionsCommand({
				LayerName: layerName,
				MaxItems: 1
			}))

			if (LayerVersions.length) {
				result = LayerVersions[0].Version
			}
		} catch (err) {
			error = err
		}

		if (error) {
			return Promise.reject(error)
		} else {
			if (result) {
				return result
			} else {
				return Promise.reject(`"${layerName}" version information could not be found.`)
			}
		}
	}

	getProfile () {
		const envProfile = process.env.AWS_PROFILE || this.serverless.processedInput.options['aws-profile']
		const profile = this.serverless.service.provider.profile

		if (profile && envProfile && profile !== envProfile) {
			this.warn(`${process.env.AWS_PROFILE ? 'AWS_PROFILE' : '--aws-profile'}=${envProfile} is applied, so the provider.profile=${profile} setting is ignored.`)
		}

		return envProfile || profile
	}

	/**
	 * match layer
	 * @param {String} layer 
	 * @returns {Object}	{ layerName, region } || null
	 */
	matchLayer (layer) {
		const matchAry = layer.match(/^(arn:aws:lambda:)([^:]+)([^\$]+):(\$LATEST$)/i)

		if (matchAry?.length === 5) {
			return {
				layerName: matchAry[1] + matchAry[2] + matchAry[3],
				region: matchAry[2]
			}
		} else {
			return null
		}
	}

	info (msg) {
		this.serverless.cli.log(`[${PLUGIN_NAME}] INFO: ${msg}`)
	}

	warn (msg) {
		this.serverless.cli.log(`[${PLUGIN_NAME}] WARNING: ${msg}`)
	}

	error (msg) {
		this.serverless.cli.log(`[${PLUGIN_NAME}] ERROR: ${msg}`)
	}
}

module.exports = AwsLatestLayerVersion