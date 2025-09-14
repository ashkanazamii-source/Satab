import { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  Typography,
  SxProps
} from '@mui/material';

type MainCardProps = {
  border?: boolean;
  boxShadow?: boolean;
  children?: ReactNode;
  content?: boolean;
  contentClass?: string;
  contentSX?: SxProps;
  headerSX?: SxProps;
  darkTitle?: boolean;
  secondary?: ReactNode;
  shadow?: string;
  sx?: SxProps;
  title?: ReactNode;
};

const MainCard = ({
  border = false,
  boxShadow,
  children,
  content = true,
  contentClass = '',
  contentSX = {},
  headerSX = {},
  darkTitle,
  secondary,
  shadow,
  sx = {},
  title,
  ...others
}: MainCardProps) => {
  const defaultShadow = '0 2px 14px 0 rgb(32 40 45 / 8%)';

  return (
    <Card
      {...others}
      sx={{
        border: border ? '1px solid' : 'none',
        borderColor: 'divider',
        ':hover': {
          boxShadow: boxShadow ? shadow || defaultShadow : 'inherit'
        },
        ...sx
      }}
    >
      {!darkTitle && title && (
        <CardHeader
          sx={{ '& .MuiCardHeader-action': { mr: 0 }, ...headerSX }}
          title={title}
          action={secondary}
        />
      )}
      {darkTitle && title && (
        <CardHeader
          sx={{ '& .MuiCardHeader-action': { mr: 0 }, ...headerSX }}
          title={<Typography variant="h3">{title}</Typography>}
          action={secondary}
        />
      )}

      {title && <Divider />}

      {content ? (
        <CardContent sx={contentSX} className={contentClass}>
          {children}
        </CardContent>
      ) : (
        children
      )}
    </Card>
  );
};

export default MainCard;
