import React from 'react';

import { thunkActions } from 'data/redux';
import { useValueCallback } from 'hooks';
import { StrictDict } from 'utils';

import * as module from './hooks';

export const state = StrictDict({
  confirmed: (val) => React.useState(val), // eslint-disable-line
  customOption: (val) => React.useState(val), // eslint-disable-line
  isSkipped: (val) => React.useState(val), // eslint-disable-line
  selectedReason: (val) => React.useState(val), // eslint-disable-line
  submittedReason: (val) => React.useState(val), // eslint-disable-line
});

export const modalStates = StrictDict({
  confirm: 'confirm',
  reason: 'reason',
  finished: 'finished',
});

export const useUnenrollReasons = () => {
  const [selectedReason, setSelectedReason] = module.state.selectedReason(null);
  const [submittedReason, setSubmittedReason] = module.state.submittedReason(null);
  const [isSkipped, setIsSkipped] = module.state.isSkipped(false);
  const [customOption, setCustomOption] = module.state.customOption('');

  return {
    clear: React.useCallback(() => {
      setSelectedReason(null);
      setSubmittedReason(null);
      setCustomOption('');
      setIsSkipped(false);
    }, [
      setSelectedReason,
      setSubmittedReason,
      setCustomOption,
      setIsSkipped,
    ]),

    value: submittedReason,

    customOption: {
      value: customOption,
      onChange: useValueCallback(setCustomOption),
    },

    selected: selectedReason,
    selectOption: useValueCallback(setSelectedReason),

    isSkipped,
    skip: React.useCallback(() => setIsSkipped(true), [setIsSkipped]),

    isSubmitted: submittedReason !== null || isSkipped,
    submit: React.useCallback(() => {
      if (selectedReason === 'custom') {
        setSubmittedReason(customOption);
      } else {
        setSubmittedReason(selectedReason);
      }
    }, [setSubmittedReason, customOption, selectedReason]),
  };
};

export const useUnenrollData = ({ closeModal, dispatch }) => {
  const [isConfirmed, setIsConfirmed] = module.state.confirmed(false);

  const confirm = React.useCallback(() => setIsConfirmed(true), [setIsConfirmed]);

  const reason = module.useUnenrollReasons();

  const close = React.useCallback(() => {
    closeModal();
    setIsConfirmed(false);
    reason.clear();
  }, [
    closeModal,
    reason,
    setIsConfirmed,
  ]);

  let modalState;
  if (isConfirmed) {
    modalState = reason.isSubmitted ? modalStates.finished : modalStates.reason;
  } else {
    modalState = modalStates.confirm;
  }

  const closeAndRefresh = React.useCallback(() => {
    dispatch(thunkActions.app.refreshList());
    closeModal();
    setIsConfirmed(false);
    reason.clear();
  }, [
    closeModal,
    dispatch,
    reason,
    setIsConfirmed,
  ]);

  return {
    isConfirmed,
    confirm,
    reason,
    close,
    closeAndRefresh,
    modalState,
  };
};

export default useUnenrollData;
