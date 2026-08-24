export const manageCopy = {
  title: 'Manage family tree',
  currentHeading: 'Current family tree',
  updateHeading: 'Update family tree',
  uploadLead: 'Upload a newer GEDCOM export from Ancestry or another genealogy application.',
  chooseFile: 'Choose GEDCOM file',
  reassurance:
    'Your photos, confirmed locations, and other Atlas additions are preserved whenever they can be safely matched.',
  editorSignIn: 'Family editor sign-in',
  manageEntry: 'Manage this Atlas',
  menuLabel: 'Manage Atlas',
  menuReview: 'Atlas Review',
  menuReviewHint: 'Review details that need your help',
  menuUpdateTree: 'Update family tree',
  menuUpdateHint: 'Upload a newer GEDCOM',
  checking: 'Checking your family tree…',
  notAppliedYet: 'Nothing has been applied yet. Your Atlas is still the current family tree.',
  checkingUnchanged: 'Your current Atlas stays as it is while we check this file.',
  stages: [
    'Uploading securely',
    'Reading family records',
    'Comparing with your current Atlas',
    'Checking photos and Atlas additions',
  ] as const,
  previewHeading: 'Here’s what changed',
  familyHeading: 'Family',
  atlasHeading: 'Your Atlas',
  added: (n: number) => (n === 1 ? '+1 person added' : `+${n} people added`),
  noLongerInFile: (n: number) =>
    n === 1
      ? '1 person is no longer in this family-tree file'
      : `${n} people are no longer in this family-tree file`,
  noLongerNote:
    'Anything already saved in the Atlas for those people is kept. They are not removed from your Atlas history.',
  matched: (n: number) => (n === 1 ? '1 person matched' : `${n} people matched`),
  updated: (n: number) => (n === 1 ? '1 person updated' : `${n} people updated`),
  photosKept: (n: number) =>
    n === 1 ? '1 photo remains with the right person' : `${n} photos remain with the right people`,
  storiesKept: (n: number) =>
    n === 1 ? '1 story remains connected' : `${n} stories remain connected`,
  filmKept: (n: number) =>
    n === 1 ? '1 film scene remains connected' : `${n} film scenes remain connected`,
  placesKept: 'Confirmed places preserved where still valid',
  needsHelp: (n: number) => (n === 1 ? '1 person needs your help' : `${n} people need your help`),
  review: 'Review',
  updateAtlas: 'Update Atlas',
  discard: 'Discard update',
  identityTitle: 'Are these the same person?',
  identityLead:
    'A few records look similar. Photos or stories already in your Atlas stay put until this is clear.',
  yesSame: 'Yes, same person',
  noDifferent: 'No, different people',
  notSure: 'I’m not sure',
  identityPending:
    'We still need a lasting way to save this answer before the Atlas can be updated. Your current Atlas is unchanged.',
  confirmTitle: 'Update your Atlas with this family tree?',
  confirmBody:
    'Nothing has been applied yet. Your Atlas is still the current family tree until you confirm. Your current tree will remain available for recovery.',
  confirmAction: 'Update Atlas',
  cancel: 'Cancel',
  completeTitle: 'Your Atlas is updated',
  completeReview: (n: number) =>
    n === 1 ? '1 detail could use your help' : `${n} details could use your help`,
  reviewAtlas: 'Review Atlas',
  returnToAtlas: 'Return to the Atlas',
  failTitle: 'We couldn’t update your family tree',
  failBody: 'Your existing Atlas is unchanged.',
  failLiveBody:
    'This copy is connected to the live Atlas, so the update was not applied. Your existing Atlas is unchanged.',
  retry: 'Try again',
  duplicateTitle: 'This family-tree file is already here',
  duplicateBody: 'You can continue with the copy already waiting, or choose a different file.',
  peopleLine: (n: number) => (n === 1 ? '1 person' : `${n} people`),
  lastUpdated: (date: string) => `Last updated: ${date}`,
}

export function canShowManageEntry(editing: boolean): boolean {
  return editing
}

export function canShowEditorSignIn(editing: boolean): boolean {
  return !editing
}
