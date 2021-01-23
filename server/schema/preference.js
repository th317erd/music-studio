const { memoizeModule } = require('../base-utils');

module.exports = memoizeModule(function(_globalOpts) {
  const globalOpts = _globalOpts || {},
        { SchemaDefinition } = require('./schema-base')(globalOpts);

  const DEFAULT_PREFERENCES = [
    {
      name: 'locale',
      value: 'en_US'
    }
  ];

  class PreferenceSchemaDefinition extends SchemaDefinition {
    constructor(parentShema, definition, schemaCode) {
      super(parentShema, definition, schemaCode);

      this.onDatabaseInitialize(async function({ schemaType, schema, database }) {
        var modelClass = schema.getModelClass(schemaType.getModelName()),
            preferences = await Promise.all((await database.query('preference').all).map((preference) => preference)),
            alreadyCreatedPreferences = {},
            createPreferences = [];

        preferences.forEach((preference) => {
          var name = (preference && preference.name);
          if (name)
            alreadyCreatedPreferences[name] = true;
        });

        for (var i = 0, il = DEFAULT_PREFERENCES.length; i < il; i++) {
          var defaultPreference = DEFAULT_PREFERENCES[i],
              prefName = defaultPreference.name;

          if (alreadyCreatedPreferences[prefName])
            continue;

          var newPref = modelClass.create({ name: prefName, value: defaultPreference.value });
          createPreferences.push(newPref);
        }

        if (createPreferences.length)
          await database.store(createPreferences);
      });

      this.addField('id', {
        primaryKey: true,
        type: 'string',
        max: this.sizeOfID('preference'),
        nullable: false,
        value: () => `${schemaCode}:${this.generateUUID()}`
      });

      this.addField('created_at', {
        updatable: false,
        defaultOrderBy: true,
        type: 'date',
        nullable: false,
        value: () => (new Date()).valueOf()
      });

      this.addField('updated_at', {
        type: 'date',
        nullable: false,
        value: () => (new Date()).valueOf(),
        onBeforeStore: () => (new Date()).valueOf()
      });

      this.addField('name', {
        type: 'string',
        max: 32,
        nullable: false
      });

      this.addField('value', {
        type: 'string',
        max: 512
      });
    }
  }

  return {
    PreferenceSchemaDefinition
  };
});
