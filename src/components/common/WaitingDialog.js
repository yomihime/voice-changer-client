// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, useTranslation, CircularProgress, Typography, Box, Dialog, DialogContent } from "../../vendor/recovered-runtime.js";
const WaitingDialog = ({
  open,
  message
}) => {
  const {
    t
  } = useTranslation();
  return jsxRuntime.jsx(Dialog, {
    open,
    disableEscapeKeyDown: true,
    sx: {
      "& .MuiDialog-paper": {
        minWidth: "300px",
        textAlign: "center"
      }
    },
    children: jsxRuntime.jsx(DialogContent, {
      sx: {
        py: 4
      },
      children: jsxRuntime.jsxs(Box, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        children: [jsxRuntime.jsx(CircularProgress, {
          size: 40
        }), jsxRuntime.jsx(Typography, {
          variant: "body1",
          children: message || t("common.waiting_dialog.default_message")
        })]
      })
    })
  });
};
export { WaitingDialog };
