/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import * as React from 'react';
import {useContext} from 'react';

import {ProfilerContext} from './ProfilerContext';
import {BridgeContext, StoreContext} from '../context';
import HookNamesModuleLoaderContext from 'react-devtools-shared/src/devtools/views/Components/HookNamesModuleLoaderContext';
import hookStyles from '../Components/InspectedElementHooksTree.css';
import {
  clearHookNamesCache,
  hasAlreadyLoadedHookNames,
  loadHookNames,
} from 'react-devtools-shared/src/hookNamesCache';
import {
  inspectElement,
  startElementUpdatesPolling,
} from 'react-devtools-shared/src/inspectedElementCache';

import styles from './WhatChanged.css';

function HookChangeSummary({
  hooks,
  hookNames,
}: {
  hooks: Array<number>,
  hookNames?: Map<number, string>,
}): React.Node {
  if (hooks.length === 0) {
    return <>No hooks changed</>;
  }

  const entries = Array.from(hookNames?.entries());

  const hookDescriptions = hooks.map(hookID => {
    const name = hookNames && entries[hookID][1];
    return (
      <span key={hookID}>
        <span className={hookStyles.PrimitiveHookNumber}>{hookID + 1}</span>
        {!!name && ` State<em>(${name})</em>`}
      </span>
    );
  });

  return (
    <>
      {hooks.length > 1 ? 'Hooks ' : 'Hook '}
      {hookDescriptions.reduce((acc, curr, idx) => (
        <>
          {acc}
          {idx === hookDescriptions.length - 1 ? ' and ' : ', '}
          {curr}
        </>
      ))}
      {' changed'}
    </>
  );
}


function hookIndicesToString(
  indices: Array<number>,
  hookNames: Map<number, string>,
): string {
  // This is debatable but I think 1-based might ake for a nicer UX.

  if (hookNames?.size > 0) {
    const entries = Array.from(hookNames.entries());

    const hooksWithNames = indices.map(hookID => {
      const entry = entries[hookID];
      const name = entry ? entry[1] : null;
      return (
        <>
          <span className={hookStyles.PrimitiveHookNumber}>{hookID + 1}</span>{' '}
          {name}
        </>
      );
    });
    return hooksWithNames.join(', ') + ' changed';
  }

  const numbers = indices.map(value => value + 1);

  switch (numbers.length) {
    case 0:
      return 'No hooks changed';
    case 1:
      return `Hook ${numbers[0]} changed`;
    case 2:
      return `Hooks ${numbers[0]} and ${numbers[1]} changed`;
    default:
      return `Hooks ${numbers.slice(0, numbers.length - 1).join(', ')} and ${
        numbers[numbers.length - 1]
      } changed`;
  }
}

type Props = {
  fiberID: number,
};

export default function WhatChanged({fiberID}: Props): React.Node {
  const {profilerStore, ...store} = useContext(StoreContext);
  const {rootID, selectedCommitIndex} = useContext(ProfilerContext);
  const bridge = useContext(BridgeContext);
  const hookNamesModuleLoader = useContext(HookNamesModuleLoaderContext);
  console.log('WhatChanged');

  // TRICKY
  // Handle edge case where no commit is selected because of a min-duration filter update.
  // If the commit index is null, suspending for data below would throw an error.
  // TODO (ProfilerContext) This check should not be necessary.
  if (selectedCommitIndex === null) {
    return null;
  }

  const {changeDescriptions} = profilerStore.getCommitData(
    ((rootID: any): number),
    selectedCommitIndex,
  );

  if (changeDescriptions === null) {
    return null;
  }

  const changeDescription = changeDescriptions.get(fiberID);
  if (changeDescription == null) {
    return null;
  }

  const {context, didHooksChange, hooks, isFirstMount, props, state} =
    changeDescription;

  const element = store._idToElement.get(fiberID);

  const alreadyLoadedHookNames =
    element != null && hasAlreadyLoadedHookNames(element);

  console.log({
    profilerStore,
    store,
  });
  console.log({
    fiberID,
    alreadyLoadedHookNames,
    element,
  });

  const hookNames =
    element &&
    loadHookNames(
      element,
      null,
      () => {}, // TODO: fix this
      () => {},
    );

  console.log('hookNames', hookNames);

  const inspectedElement = inspectElement(element, state?.path, store, bridge);

  console.log('inspectedElement', inspectedElement);

  if (isFirstMount) {
    return (
      <div className={styles.Component}>
        <label className={styles.Label}>Why did this render?</label>
        <div className={styles.Item}>
          This is the first time the component rendered.
        </div>
      </div>
    );
  }

  const changes = [];

  if (context === true) {
    changes.push(
      <div key="context" className={styles.Item}>
        • Context changed
      </div>,
    );
  } else if (
    typeof context === 'object' &&
    context !== null &&
    context.length !== 0
  ) {
    changes.push(
      <div key="context" className={styles.Item}>
        • Context changed:
        {context.map(key => (
          <span key={key} className={styles.Key}>
            {key}
          </span>
        ))}
      </div>,
    );
  }

  console.log({didHooksChange, hooks
  });

  if (didHooksChange) {
    if (Array.isArray(hooks)) {
      changes.push(
        <div key="hooks" className={styles.Item}>
          • <HookChangeSummary hooks={hooks} hookNames={hookNames} />
        </div>,
      );
    } else {
      changes.push(
        <div key="hooks" className={styles.Item}>
          • Hooks changed
        </div>,
      );
    }
  }

  if (props !== null && props.length !== 0) {
    changes.push(
      <div key="props" className={styles.Item}>
        • Props changed:
        {props.map(key => (
          <span key={key} className={styles.Key}>
            {key}
          </span>
        ))}
      </div>,
    );
  }

  if (state !== null && state.length !== 0) {
    changes.push(
      <div key="state" className={styles.Item}>
        • State changed:
        {state.map(key => (
          <span key={key} className={styles.Key}>
            {key}
          </span>
        ))}
      </div>,
    );
  }

  if (changes.length === 0) {
    changes.push(
      <div key="nothing" className={styles.Item}>
        The parent component rendered.
      </div>,
    );
  }

  return (
    <div>
      <label className={styles.Label}>Why did this render?</label>
      {changes}
    </div>
  );
}
