import { Box, Grid, Icon, Input, Text } from '@chakra-ui/react';
import { MdAdd, MdDeleteOutline } from 'react-icons/md';

export type RowColumn<T> = {
  key: Extract<keyof T, string>;
  label: string;
  type: 'text' | 'number';
  step?: number;
  placeholder?: string;
};

const fieldStyle = {
  bg: 'ink.bg',
  border: '1px solid',
  borderColor: 'ink.cardBorder',
  borderRadius: '6px',
  fontSize: '13px',
  h: '34px',
};

export function EditableRowList<T extends { id: string }>({
  rows,
  columns,
  templateColumns,
  onChange,
  onAdd,
  onRemove,
  addLabel,
  minRows = 0,
  readOnly = false,
}: {
  rows: T[];
  columns: Array<RowColumn<T>>;
  templateColumns: string;
  onChange: (id: string, key: Extract<keyof T, string>, value: string | number) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  addLabel: string;
  minRows?: number;
  readOnly?: boolean;
}) {
  const rowTemplateColumns = readOnly ? templateColumns : `${templateColumns} 32px`;

  return (
    <Box display="flex" flexDirection="column" gap="8px">
      {rows.length > 0 && (
        <Grid
          templateColumns={rowTemplateColumns}
          gap="8px"
          fontSize="11px"
          fontWeight="700"
          color="ink.textFaintest"
          textTransform="uppercase"
        >
          {columns.map((col) => (
            <Text key={col.key}>{col.label}</Text>
          ))}
          {!readOnly && <Box />}
        </Grid>
      )}
      {rows.map((row) => (
        <Grid key={row.id} templateColumns={rowTemplateColumns} gap="8px" alignItems="center">
          {columns.map((col) => (
            <Input
              key={col.key}
              type={col.type}
              step={col.step}
              placeholder={col.placeholder}
              value={(row[col.key] as string | number | undefined) ?? ''}
              onChange={(e) =>
                onChange(row.id, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)
              }
              isReadOnly={readOnly}
              fontFamily={col.type === 'number' ? 'mono' : undefined}
              {...fieldStyle}
            />
          ))}
          {!readOnly &&
            (rows.length > minRows ? (
              <Box
                as="button"
                type="button"
                onClick={() => onRemove(row.id)}
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="28px"
                h="28px"
                borderRadius="6px"
                color="danger.500"
                _hover={{ bg: 'ink.card' }}
              >
                <Icon as={MdDeleteOutline} boxSize="16px" />
              </Box>
            ) : (
              <Box />
            ))}
        </Grid>
      ))}
      {!readOnly && (
        <Box
          as="button"
          type="button"
          onClick={onAdd}
          alignSelf="flex-start"
          display="flex"
          alignItems="center"
          gap="6px"
          px="12px"
          py="7px"
          borderRadius="6px"
          border="1px solid"
          borderColor="ink.borderStrong"
          color="ink.textSecondary"
          fontSize="12px"
          fontWeight="600"
          _hover={{ bg: 'ink.card' }}
        >
          <Icon as={MdAdd} boxSize="12px" />
          {addLabel}
        </Box>
      )}
    </Box>
  );
}
