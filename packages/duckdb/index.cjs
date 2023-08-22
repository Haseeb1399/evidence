const {
	getEnv,
	EvidenceType,
	TypeFidelity,
	stringifyNonstringColumns
} = require('@evidence-dev/db-commons');
const { Database, OPEN_READONLY, OPEN_READWRITE } = require('duckdb-async');
const path = require('path');

const envMap = {
	filename: [
		{ key: 'EVIDENCE_DUCKDB_FILENAME', deprecated: false },
		{ key: 'DUCKDB_FILENAME', deprecated: false },
		{ key: 'filename', deprecated: true },
		{ key: 'FILENAME', deprecated: true }
	]
};

/**
 *
 * @param {unknown} data
 * @returns {EvidenceType}
 */
function nativeTypeToEvidenceType(data) {
	switch (typeof data) {
		case 'number':
			return EvidenceType.NUMBER;
		case 'boolean':
			return EvidenceType.BOOLEAN;
		case 'object':
			if (data instanceof Date) {
				return EvidenceType.DATE;
			}
		// eslint-disable-next-line no-fallthrough
		default:
			return EvidenceType.STRING;
	}
}

/**
 *
 * @param {Record<string, unknown>[]} rows
 * @returns {import('@evidence-dev/db-commons').ColumnDefinition[]}
 */
const mapResultsToEvidenceColumnTypes = function (rows) {
	return Object.entries(rows[0]).map(([name, value]) => {
		const typeFidelity = TypeFidelity.PRECISE;
		const evidenceType = nativeTypeToEvidenceType(value);
		return { name, evidenceType, typeFidelity };
	});
};

/** @type {import("@evidence-dev/db-commons").RunQuery<DuckDBOptions>} */
const runQuery = async (queryString, database) => {
	const filename = database ? database.filename : getEnv(envMap, 'filename');
	const mode = filename !== ':memory:' ? OPEN_READONLY : OPEN_READWRITE;

	try {
		const db = await Database.create(filename, mode);
		const result = await db.all(queryString);
		const columnTypes = mapResultsToEvidenceColumnTypes(result);
		const rows = stringifyNonstringColumns(result, columnTypes);
		return { rows, columnTypes };
	} catch (err) {
		if (err.message) {
			throw err.message;
		} else {
			throw err;
		}
	}
};

module.exports = runQuery;

/**
 * @typedef {Object} DuckDBOptions
 * @property {string} filename
 */

/**
 * @typedef {Object} QueryResult
 * @property { Record<string, any>[] } rows
 * @property { { name: string, evidenceType: string, typeFidelity: string }[] } columnTypes
 */

/** @type {import("@evidence-dev/db-commons").GetRunner<DuckDBOptions>} */
module.exports.getRunner = async (opts, directory) => {
	if (!opts.filename) {
		console.error(`Missing required duckdb option 'filename' (${directory})`);
	}

	return async (queryContent, queryPath) => {
		// Filter out non-sql files
		if (!queryPath.endsWith('.sql')) return null;
		return runQuery(queryContent, { ...opts, filename: path.join(directory, opts.filename) });
	};
};
