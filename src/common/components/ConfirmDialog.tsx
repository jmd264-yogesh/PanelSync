'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/common/components/ui/alert-dialog';

interface TConfirmDialogProps {
  /** The element that opens the dialog when clicked (e.g. a styled <button>). Do not pass its own children here — use `triggerChildren` instead. */
  trigger: React.ReactElement;
  /** Visual content of the trigger (icon, text, etc). Passed separately so it survives the base-ui `render` prop merge. */
  triggerChildren?: React.ReactNode;
  title: string;
  description: string;
  /** Label for the confirm button, e.g. "Yes, Delete" / "Yes, Remove" / "Yes, Add". */
  confirmLabel: string;
  onConfirm: () => void;
  /** Renders the confirm button in the destructive (red) style. Defaults to true. */
  destructive?: boolean;
}

export const ConfirmDialog = ({
  trigger,
  triggerChildren,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: TConfirmDialogProps) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger}>{triggerChildren}</AlertDialogTrigger>
      <AlertDialogContent className="p-6!">
        <AlertDialogHeader className="space-y-2">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="p-4!">Cancel</AlertDialogCancel>
          <AlertDialogAction className="p-4!" variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
