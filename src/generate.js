const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const async = require('async');
const metalsmith = require('metalsmith');
const render = require('consolidate').handlebars.render;
const toSlugCase = require('to-slug-case');
const toSnakeCase = require('to-snake-case');
const toCamelCase = require('to-camel-case');
const toPascalCase = require('to-pascal-case');
const isTextOrBinary = require('istextorbinary');

module.exports = function generate(type, options, settings) {
	const paths = settings.templatePath.split(',');

	templatePath = paths.find((templatePath) => pathExists(path.join(templatePath, '/' + type)));

	if(!templatePath) {
		console.log();
		console.error(chalk.red(`Template folder that contains template ${type} doesn't exist`));
		return;
	}

	if (!pathExists(templatePath)) {
		console.log();
		console.error(chalk.red(`Template folder (${path.resolve(settings.templatePath)}) doesn't exist`));
		return;
	}

	const fullTemplatePath = path.join(templatePath, '/' + type);

	console.log();
	console.log(chalk.green(chalk.bold(`Generating files from '${type}' template with name: ${options.name}`)));

	metalsmith(fullTemplatePath)
		.metadata(Object.assign({}, getNames(options.name)))
		.source('.')
		.destination(path.resolve(options.destination))
		.clean(false)
		.use(filterSettings)
		.use(renderPaths)
		.use(renderTemplates)
		.build(function (err) {
			if (err) {
				console.error(chalk.red(err));
			}
			else {
				console.log();
				console.log(chalk.green('Done!'));
			}
		});
};

function getNames(name) {

	return {
		name,
		name_cc: toCamelCase(name),
		name_pc: toPascalCase(name),
		name_sc: toSlugCase(name),
		name_snc: toSnakeCase(name),
	}
}

function pathExists(value) {
	return fs.existsSync(path.resolve(value));
}

function renderPaths(files, metalsmith, done) {
	const keys = Object.keys(files);
	const metadata = metalsmith.metadata();

	keys.forEach((key) => {
		let newKey = replaceVars(key, metadata);

		if (newKey != key) {
			files[newKey] = files[key];
			delete files[key];
		}
	});

	done();
}

function filterSettings(files, metalsmith, done) {
	const keys = Object.keys(files);

	keys.forEach((key) => {
		if (key.slice(0, 1) == '.') {
			delete files[key];
		}
	});

	done();
}

function renderTemplates(files, metalsmith, done) {
	const keys = Object.keys(files);
	const metadata = metalsmith.metadata();

	async.each(keys, run, done);

	function run(file, done) {
		if(isTextOrBinary.isBinarySync(path.basename(file), files[file].contents)) {
			done();
			return;
		}
		let str = files[file].contents.toString();
		render(str, metadata, function (err, res) {
			if (err) {
				return done(err);
			}
			files[file].contents = new Buffer(res);
			done();
		});
	}
}

function replaceVars(value, object) {
	return value.replace(/\$?\{([@#$%&\w\.]*)(\((.*?)\))?\}/gi, (match, name) => {
		const props = name.split(".");
		const prop = props.shift();
		let o = object;

		if (o != null && prop in o) {
			return o[prop];
		}
		return '';
	});
}

