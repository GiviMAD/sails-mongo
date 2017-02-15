//   ██████╗██████╗ ███████╗ █████╗ ████████╗███████╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔════╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ██║     ██████╔╝█████╗  ███████║   ██║   █████╗      ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██╔══╝      ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ╚██████╗██║  ██║███████╗██║  ██║   ██║   ███████╗    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//   ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({


  friendlyName: 'Create',


  description: 'Insert a record into a table in the database.',


  inputs: {

    datastore: {
      description: 'The datastore to use for connections.',
      extendedDescription: 'Datastores represent the config and manager required to obtain an active database connection.',
      required: true,
      readOnly: true,
      example: '==='
    },

    models: {
      description: 'An object containing all of the model definitions that have been registered.',
      required: true,
      example: '==='
    },

    query: {
      description: 'A valid stage three Waterline query.',
      required: true,
      example: '==='
    }

  },


  exits: {

    success: {
      description: 'The record was successfully inserted.',
      outputVariableName: 'record',
      example: '==='
    },

    invalidDatastore: {
      description: 'The datastore used is invalid. It is missing key pieces.'
    },

    badConnection: {
      friendlyName: 'Bad connection',
      description: 'A connection either could not be obtained or there was an error using the connection.'
    },

    notUnique: {
      friendlyName: 'Not Unique',
      example: '==='
    }

  },


  fn: function create(inputs, exits) {
    // Dependencies
    var _ = require('@sailshq/lodash');
    var Helpers = require('./private');


    // Store the Query input for easier access
    var query = inputs.query;
    query.meta = query.meta || {};

    // Find the model definition
    var model = inputs.models[query.using];
    if (!model) {
      return exits.invalidDatastore();
    }

    // Set a flag to determine if records are being returned
    var fetchRecords = false;


    // Build a faux ORM for use in processEachRecords
    var fauxOrm = {
      collections: inputs.models
    };

    //  ╔═╗╦═╗╔═╗  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┐
    //  ╠═╝╠╦╝║╣───╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  ├┬┘├┤ │  │ │├┬┘ ││└─┐
    //  ╩  ╩╚═╚═╝  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ┴└─└─┘└─┘└─┘┴└──┴┘└─┘
    // Process each record to normalize output
    try {
      Helpers.query.preProcessRecord({
        records: [query.newRecord],
        identity: model.identity,
        orm: fauxOrm
      });
    } catch (e) {
      return exits.error(e);
    }


    //  ╔╦╗╔═╗╔╦╗╔═╗╦═╗╔╦╗╦╔╗╔╔═╗  ┬ ┬┬ ┬┬┌─┐┬ ┬  ┬  ┬┌─┐┬  ┬ ┬┌─┐┌─┐
    //   ║║║╣  ║ ║╣ ╠╦╝║║║║║║║║╣   │││├─┤││  ├─┤  └┐┌┘├─┤│  │ │├┤ └─┐
    //  ═╩╝╚═╝ ╩ ╚═╝╩╚═╩ ╩╩╝╚╝╚═╝  └┴┘┴ ┴┴└─┘┴ ┴   └┘ ┴ ┴┴─┘└─┘└─┘└─┘
    //  ┌┬┐┌─┐  ┬─┐┌─┐┌┬┐┬ ┬┬─┐┌┐┌
    //   │ │ │  ├┬┘├┤  │ │ │├┬┘│││
    //   ┴ └─┘  ┴└─└─┘ ┴ └─┘┴└─┘└┘
    if (_.has(query.meta, 'fetch') && query.meta.fetch) {
      fetchRecords = true;
    }


    // Find the Primary Key
    var primaryKeyField = model.primaryKey;
    var primaryKeyColumnName = model.definition[primaryKeyField].columnName;

    // Remove primary key if the value is NULL. This allows the auto-increment
    // to work properly if set.
    if (_.isNull(query.newRecord[primaryKeyColumnName])) {
      delete query.newRecord[primaryKeyColumnName];
    }

    // Always make sure either _id is set to something valid or removed.
    // Default value for _id is an empty string which blows up on Mongo.
    if (_.has(query.newRecord, '_id')) {
      if (query.newRecord._id === '') {
        delete query.newRecord._id;
      }
    }

    // Get mongo collection (and spawn a new connection)
    var collection = inputs.datastore.manager.collection(query.using);


    //  ╦╔╗╔╔═╗╔═╗╦═╗╔╦╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐
    //  ║║║║╚═╗║╣ ╠╦╝ ║   ├┬┘├┤ │  │ │├┬┘ ││
    //  ╩╝╚╝╚═╝╚═╝╩╚═ ╩   ┴└─└─┘└─┘└─┘┴└──┴┘
    // Insert the record and return the new values
    Helpers.query.create({
      collection: collection,
      query: query
    },

    function createRecordCb(err, insertedRecords) {
      // If there was an error return it.
      if (err) {
        if (err.footprint && err.footprint.identity === 'notUnique') {
          return exits.notUnique(err);
        }

        return exits.error(err);
      }

      if (fetchRecords) {
        // Process each record to normalize output
        try {
          Helpers.query.processEachRecord({
            records: insertedRecords,
            identity: model.identity,
            orm: fauxOrm
          });
        } catch (e) {
          return exits.error(e);
        }

        // Only return the first record (there should only ever be one)
        var insertedRecord = _.first(insertedRecords);
        return exits.success({ record: insertedRecord });
      }

      return exits.success();
    }); // </ .insertRecord(); >
  }
});
