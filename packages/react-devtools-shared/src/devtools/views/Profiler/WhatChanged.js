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
  hasAlreadyLoadedHookNames,
  loadHookNames,
} from 'react-devtools-shared/src/hookNamesCache';
import {
  inspectElement,
} from 'react-devtools-shared/src/inspectedElementCache';

import type {InspectedElement} from 'react-devtools-shared/src/frontend/types';

import styles from './WhatChanged.css';

function getHookName(hookSource, hookNames) {
  const key = `${hookSource.fileName}:${hookSource.lineNumber}:${hookSource.columnNumber}`;
  return hookNames.get(key);
}

function extractHookDescriptions({
  hooks: allHooks,
  hookNames,
}: {
  hooks: InspectedElement['hooks'],
  hookNames?: Map<number, string>,
}) {
  const descriptions = {};

  function traverseHooks(hooks: InspectedElement['hooks']) {
    if (hookNames?.size > 0 && hooks?.length > 0)
      hooks?.forEach(hook => {
        if (hook.id !== null) {
          console.log('hookSource', hook.hookSource);
          const name = hookNames && getHookName(hook.hookSource, hookNames);
          descriptions[hook.id] = {name, type: hook.name};
        }
        if (hook.subHooks.length > 0) {
          traverseHooks(hook.subHooks);
        }
      });
  }

  traverseHooks(allHooks);
  return descriptions;
}

function HookChangeSummary({
  hooks,
  hookNames,
  inspectedElement,
}: {
  hooks: Array<number>,
  hookNames?: Map<number, string>,
  inspectedElement?: InspectedElement,
}): React.Node {
  if (hooks.length === 0) {
    return <>No hooks changed</>;
  }

  const descriptions = extractHookDescriptions({
    hooks: inspectedElement?.hooks,
    hookNames,
  });

  const hookDescriptions = hooks.map(hookID => {
    if (descriptions?.[hookID]?.name && descriptions?.[hookID]?.type) {
      const {name, type} = descriptions[hookID];

      return (
        <span key={hookID}>
          <span className={hookStyles.PrimitiveHookNumber}>{hookID + 1}</span>
          {!!name && !!type && (
            <>
              {type}
              <strong>({name})</strong>
            </>
          )}
        </span>
      );
    }

    return (
      <span key={hookID}>
        <span className={hookStyles.PrimitiveHookNumber}>{hookID + 1}</span>
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

  let hookNames;
  let inspectedElement;
  try {
    hookNames =
      element &&
      loadHookNames(
        element,
        null,
        () => {}, // TODO: fix this
        () => {},
      );
  } catch (error) {
    console.error('hookNames error', error);
  }

  try {
    inspectedElement = inspectElement(element, state?.path, store, bridge);
  } catch (error) {
    console.error('inspectedElement error', error);
  }

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

  console.log({didHooksChange, hooks});

  if (didHooksChange) {
    if (Array.isArray(hooks)) {
      changes.push(
        <div key="hooks" className={styles.Item}>
          •{' '}
          <HookChangeSummary
            hooks={hooks}
            hookNames={hookNames}
            inspectedElement={inspectedElement}
          />
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
