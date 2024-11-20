/**
 * @flow
 */

import * as React from 'react';
import {useContext} from 'react';
import ButtonIcon from '../ButtonIcon';
import {SettingsContext} from '../Settings/SettingsContext';
import Toggle from '../Toggle';

export default function TraceUpdatestToggle(): React.Node {
  const {setTraceUpdatesEnabled, traceUpdatesEnabled} =
    useContext(SettingsContext);

  return (
    <Toggle
      isChecked={traceUpdatesEnabled}
      onChange={setTraceUpdatesEnabled}
      title="Highlight updates when components render">
      <ButtonIcon type="highlight-updates" />
    </Toggle>
  );
}
