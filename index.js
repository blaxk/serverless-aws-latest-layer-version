const AWS = require('aws-sdk')
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

			if (/^(arn:aws:lambda:)([^:]+)([^\$]+):(\$LATEST$)/i.test(layer)) {
				const layerName = RegExp.$1 + RegExp.$2 + RegExp.$3
				let latestVersion = 0

				if (this.cache.has(layerName)) {
					latestVersion = this.cache.get(layerName)
				} else {
					try {
						latestVersion = await this.getLatestLayerVersion(RegExp.$2, layerName)
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
		const credentials = profile ? new AWS.SharedIniFileCredentials({ profile }) : profile

		const lambda = new AWS.Lambda({
			apiVersion: '2015-03-31',
			region: region,
			credentials
		})

		const versions = []
		let marker
		let error

		do {
			try {
				const { LayerVersions, NextMarker } = await lambda.listLayerVersions({
					LayerName: layerName,
					Marker: marker,
				}).promise()

				versions.push(...LayerVersions.map((layer) => layer.Version))
				marker = NextMarker
			} catch (err) {
				marker = null
				error = err
			}
		} while (marker)

		if (error) {
			return Promise.reject(error)
		} else {
			if (versions.length) {
				return Math.max(...versions)
			} else {
				return Promise.reject(`"${layerName}" version information could not be found.`)
			}
		}
	}

	getProfile () {
		const envProfile = process.env.AWS_PROFILE || this.serverless.processedInput.options['aws-profile']
		let profile = this.serverless.service.provider.profile

		if (profile) {
			if (envProfile && profile !== envProfile) {
				this.warn(`${process.env.AWS_PROFILE ? 'AWS_PROFILE' : '--aws-profile'}=${envProfile} is applied, so the provider.profile=${profile} setting is ignored.`)
				profile = envProfile
			}
		}

		return profile
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