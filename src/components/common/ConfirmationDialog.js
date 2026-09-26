// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTheme, Button } from "../../vendor/recovered-runtime.js";
const ConfirmationDialog = ({
  isOpen,
  title,
  message,
  confirmButtonText,
  cancelButtonText,
  onConfirm,
  onCancel,
  showCancelButton: T = true,
  messageExtra
}) => {
  const O = useTheme();
  return ReactRuntime.useMemo(() => isOpen ? jsxRuntime.jsx("div", {
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    },
    onClick: onCancel,
    children: jsxRuntime.jsxs("div", {
      style: {
        backgroundColor: O.palette.background.paper,
        color: O.palette.text.primary,
        padding: "20px",
        borderRadius: "8px",
        maxWidth: "400px",
        width: "100%"
      },
      onClick: ee => ee.stopPropagation(),
      children: [jsxRuntime.jsx("h3", {
        style: {
          marginTop: 0,
          color: O.palette.text.primary
        },
        children: title
      }), jsxRuntime.jsx("p", {
        style: {
          color: O.palette.text.primary
        },
        children: message
      }), messageExtra && jsxRuntime.jsx("div", {
        style: {
          marginTop: 8
        },
        children: messageExtra
      }), jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          marginTop: "20px"
        },
        children: [T && jsxRuntime.jsx(Button, {
          variant: "contained",
          color: "primary",
          onClick: onCancel,
          children: cancelButtonText
        }), jsxRuntime.jsx(Button, {
          onClick: onConfirm,
          variant: "contained",
          color: "primary",
          children: confirmButtonText
        })]
      })]
    })
  }) : null, [isOpen, title, message, confirmButtonText, cancelButtonText, onConfirm, onCancel, T, messageExtra, O]);
};
export { ConfirmationDialog };
