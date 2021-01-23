import {
  mapToKeys,
  getID,
  createSelector,
  createCachedSelector,
  convertToArray
} from '../common';

function filterPreferencesByIDs(state, preferences) {
  if (!preferences)
    return [];

  return Object.keys(preferences).filter((key) => (/^[A-Z]{2}:/).test(key)).map((key) => preferences[key].data);
}

const getPreferences      = createSelector('preferences', filterPreferencesByIDs),
      getPreference       = createSelector((state, preference) => preference, (state, preference) => {
                            var preferences     = state.preferences,
                                preferenceID    = getID(preference),
                                thisPreference  = (preferences && preferences[preferenceID]);

                            return (thisPreference && thisPreference.data);
                          }),
      getPreferenceValue  = createSelector(getPreference, (s, p, defaultValue) => defaultValue, (state, preference, defaultValue) => {
                            var preferenceValue = (preference && preference.value);
                            return (preferenceValue == null) ? defaultValue : preferenceValue;
                          });

export default {
  template: {
    preferences: mapToKeys(['id', 'name'])
  },
  selectors: {
    getPreferences,
    getPreference,
    getPreferenceValue
  }
};
