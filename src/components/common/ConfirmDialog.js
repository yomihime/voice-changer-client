// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, useTranslation, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "../../vendor/recovered-runtime.js";
const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText
}) => {
  const {
      t
    } = useTranslation(),
    A = () => {
      onConfirm();
      onClose();
    };
  return jsxRuntime.jsxs(Dialog, {
    open,
    onClose,
    maxWidth: "sm",
    fullWidth: true,
    children: [jsxRuntime.jsx(DialogTitle, {
      children: title
    }), jsxRuntime.jsx(DialogContent, {
      children: jsxRuntime.jsx(DialogContentText, {
        children: message
      })
    }), jsxRuntime.jsxs(DialogActions, {
      children: [jsxRuntime.jsx(Button, {
        onClick: onClose,
        color: "primary",
        children: cancelText || t("common.dialog.cancel")
      }), jsxRuntime.jsx(Button, {
        onClick: A,
        color: "error",
        variant: "contained",
        children: confirmText || t("common.dialog.confirm")
      })]
    })]
  });
};
export { ConfirmDialog };
