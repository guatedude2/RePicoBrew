import { Box, Button, Flex, HStack, Icon, Input, Text } from '@chakra-ui/react';
import { useFetcher } from '@remix-run/react';
import { useEffect, useState, type FC } from 'react';
import { MdCheck } from 'react-icons/md';

const METHODS = [
  { label: 'Bottle', unit: 'weeks' },
  { label: 'Keg', unit: 'weeks' },
  { label: 'Forced (CO2)', unit: 'hours' },
];

const RING_COLOR = 'oklch(0.75 0.13 100)';
export const FERM_RING_COLOR = 'oklch(0.78 0.135 65)';

export type CarbonationData = {
  batchId: number;
  carbMethod: string | null;
  carbDuration: number | null;
  carbUnit: string | null;
  carbStartedAt: string | null;
  carbStatus: string | null;
  carbExtendMinutes: number | null;
  isCompleted: boolean;
};

const msFor = (duration: number, unit: string) =>
  unit === 'weeks' ? duration * 7 * 24 * 60 * 60 * 1000 : duration * 60 * 60 * 1000;

export const Ring: FC<{ percent: number; label: string; color?: string }> = ({
  percent,
  label,
  color = RING_COLOR,
}) => (
  <Box
    position="relative"
    w="96px"
    h="96px"
    flex="0 0 auto"
    borderRadius="full"
    display="flex"
    alignItems="center"
    justifyContent="center"
    sx={{ background: `conic-gradient(${color} ${percent}%, oklch(0.26 0.008 260) 0)` }}
  >
    <Flex w="78px" h="78px" borderRadius="full" bg="ink.card" direction="column" align="center" justify="center">
      <Text fontFamily="mono" fontSize="18px" fontWeight="700">
        {percent}%
      </Text>
      <Text fontSize="9px" color="ink.textFaint">
        {label}
      </Text>
    </Flex>
  </Box>
);

// Picks a carbonation method + duration and kicks off the countdown — the normal path is from
// the Bottling step, but it also serves as a fallback inside Carbonation for any batch that
// reached that phase without going through Bottling (e.g. data seeded before Bottling existed).
export const CarbonationSetupForm: FC<{
  batchId: number;
  initialMethod?: string | null;
  initialDuration?: number | null;
}> = ({ batchId, initialMethod, initialDuration }) => {
  const fetcher = useFetcher();
  const [method, setMethod] = useState(initialMethod ?? 'Bottle');
  const [duration, setDuration] = useState(initialDuration ?? 2);
  const unit = METHODS.find((m) => m.label === method)?.unit ?? 'weeks';

  return (
    <Box display="flex" flexDirection="column" gap="14px">
      <HStack spacing="10px" wrap="wrap">
        {METHODS.map((m) => (
          <Box
            key={m.label}
            as="button"
            type="button"
            onClick={() => setMethod(m.label)}
            flex="1"
            minW="120px"
            px="16px"
            py="14px"
            borderRadius="10px"
            bg={method === m.label ? 'brand.100' : 'ink.bg'}
            border="1px solid"
            borderColor={method === m.label ? 'brand.500' : 'ink.divider'}
            color={method === m.label ? 'ink.text' : 'ink.textSecondary'}
            fontSize="14px"
            fontWeight="700"
          >
            {m.label}
          </Box>
        ))}
      </HStack>
      <HStack spacing="12px" align="flex-end" wrap="wrap">
        <Box>
          <Text fontSize="11px" fontWeight="600" color="ink.textSecondary" mb="6px">
            Duration ({unit})
          </Text>
          <Input
            type="number"
            min={1}
            w="100px"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            fontFamily="mono"
          />
        </Box>
        <Button
          variant="brand"
          isLoading={fetcher.state !== 'idle'}
          onClick={() =>
            fetcher.submit(JSON.stringify({ intent: 'startCarbonation', method, duration, unit }), {
              method: 'post',
              action: `/api/batches/${batchId}`,
              encType: 'application/json',
            })
          }
        >
          Start Carbonating
        </Button>
      </HStack>
    </Box>
  );
};

export const CarbonationSection: FC<{ data: CarbonationData }> = ({ data }) => {
  const fetcher = useFetcher();
  const [extendAmount, setExtendAmount] = useState(1);
  const [stage, setStage] = useState<'counting' | 'extend'>('counting');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (data.carbStatus !== 'counting') {
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data.carbStatus]);

  const submit = (body: Record<string, unknown>) => {
    fetcher.submit(JSON.stringify(body), {
      method: 'post',
      action: `/api/batches/${data.batchId}`,
      encType: 'application/json',
    });
  };

  if (data.isCompleted || data.carbStatus === 'finished') {
    return (
      <Flex direction="column" align="center" gap="8px" py="16px" textAlign="center">
        <Flex w="40px" h="40px" borderRadius="full" bg="success.100" align="center" justify="center">
          <Icon as={MdCheck} boxSize="20px" color="success.500" />
        </Flex>
        <Text fontSize="14px" fontWeight="700">
          Carbonation complete
        </Text>
        <Text fontSize="12px" color="ink.textFaint">
          {data.carbMethod ?? 'Batch'} · session finished
        </Text>
      </Flex>
    );
  }

  if (!data.carbStatus || data.carbStatus === 'setup') {
    return (
      <Box display="flex" flexDirection="column" gap="14px">
        <Text fontSize="12px" color="ink.textSecondary">
          This step has no sensor tracking — it&apos;s manual. Choose a method and how long, then start.
        </Text>
        <CarbonationSetupForm
          batchId={data.batchId}
          initialMethod={data.carbMethod}
          initialDuration={data.carbDuration}
        />
      </Box>
    );
  }

  const startedMs = data.carbStartedAt ? new Date(data.carbStartedAt).getTime() : now;
  const totalMs = msFor(data.carbDuration ?? 0, data.carbUnit ?? 'weeks') + (data.carbExtendMinutes ?? 0) * 60 * 1000;
  const elapsedMs = Math.max(0, now - startedMs);
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const percent = totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0;
  const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (stage === 'extend') {
    return (
      <Box display="flex" flexDirection="column" gap="14px">
        <Text fontSize="12px" color="ink.textSecondary">
          Add more time to keep carbonating with {data.carbMethod}.
        </Text>
        <HStack spacing="12px" align="flex-end" wrap="wrap">
          <Box>
            <Text fontSize="11px" fontWeight="600" color="ink.textSecondary" mb="6px">
              Additional Duration (days)
            </Text>
            <Input
              type="number"
              min={1}
              w="100px"
              value={extendAmount}
              onChange={(e) => setExtendAmount(Number(e.target.value))}
              fontFamily="mono"
            />
          </Box>
          <Button
            variant="brand"
            isLoading={fetcher.state !== 'idle'}
            onClick={() => {
              submit({ intent: 'extendCarbonation', extendMinutes: extendAmount * 24 * 60 });
              setStage('counting');
            }}
          >
            Extend Countdown
          </Button>
          <Button variant="outline" onClick={() => setStage('counting')}>
            Cancel
          </Button>
        </HStack>
      </Box>
    );
  }

  // counting
  return (
    <Box display="flex" flexDirection="column" gap="14px">
      <Flex justify="space-between" align="center" wrap="wrap" gap="24px">
        <Box>
          <Text fontSize="11px" fontWeight="700" letterSpacing="0.5px" color="ink.textFaint" textTransform="uppercase">
            Total Carbonation Time Left · {data.carbMethod}
          </Text>
          <Text fontFamily="mono" fontSize="38px" fontWeight="300" mt="4px">
            {days}d {hours}h
          </Text>
          <Text fontSize="12px" color="ink.textFaint" mt="4px">
            Started {data.carbStartedAt ? new Date(data.carbStartedAt).toLocaleString() : '—'}
          </Text>
        </Box>
        <Ring percent={percent} label="Complete" />
      </Flex>
      <HStack spacing="10px">
        <Button variant="outline" flex="1" onClick={() => setStage('extend')}>
          Extend
        </Button>
        <Button
          variant="brand"
          flex="1"
          isLoading={fetcher.state !== 'idle'}
          onClick={() => submit({ intent: 'finishCarbonation' })}
        >
          Done
        </Button>
      </HStack>
    </Box>
  );
};
