import { Box, Typography } from '@mui/material';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <Box>
      <Typography variant="h5">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Coming next.
      </Typography>
    </Box>
  );
}
