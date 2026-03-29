import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

/**
 * Componente reutilizável de confirmação.
 *
 * Props:
 *   open         {boolean}  — controla visibilidade
 *   title        {string}   — título do diálogo
 *   message      {node}     — corpo do diálogo (string ou JSX)
 *   confirmLabel {string}   — texto do botão de confirmação (default: "Confirmar")
 *   confirmColor {string}   — cor MUI do botão (default: "warning")
 *   onConfirm    {function} — callback ao confirmar
 *   onClose      {function} — callback ao cancelar/fechar
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  confirmColor = 'warning',
  onConfirm,
  onClose,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: 3, minWidth: 400 } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} variant="outlined">
          Cancelar
        </Button>
        <Button onClick={onConfirm} variant="contained" color={confirmColor} autoFocus>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}