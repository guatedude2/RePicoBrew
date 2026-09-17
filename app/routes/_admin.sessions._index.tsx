import type { LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useSearchParams, useFetcher, useNavigate, Link } from '@remix-run/react';
import {
  Box,
  Button,
  Flex,
  Grid,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Portal,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { useState, type FC } from 'react';
import {
  MdAdd,
  MdArchive,
  MdArrowDownward,
  MdArrowUpward,
  MdCancel,
  MdChevronLeft,
  MdChevronRight,
  MdHistory,
  MdMoreVert,
  MdWarning,
} from 'react-icons/md';
import Card from '~/components/card/Card';
import { BatchRepository } from '~/repositories/batch.server';
import { BatchPhase } from '~/types';
import { batchNeedsAttention, phaseAccent, phaseLabel } from '~/utils/batch-phase';

export const meta = () => [{ title: 'Sessions | RePicoBrew' }];

const PAGE_SIZE = 10;
type SortKey = 'date' | 'recipe' | 'device' | 'status';
type SortDir = 'asc' | 'desc';
const SORT_KEYS: SortKey[] = ['date', 'recipe', 'device', 'status'];
const DEFAULT_DIR: Record<SortKey, SortDir> = { date: 'desc', recipe: 'asc', device: 'asc', status: 'asc' };
const LIVE_PHASES: string[] = [
  BatchPhase.BREWING,
  BatchPhase.COOLING,
  BatchPhase.FERMENTING,
  BatchPhase.BOTTLING,
  BatchPhase.CARBONATING,
];

export const loader = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get('page'));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const sortParam = url.searchParams.get('sort');
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'date';
  const dirParam = url.searchParams.get('dir');
  const dir: SortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : DEFAULT_DIR[sort];
  const { batches, total } = await BatchRepository.listPaginated(page, PAGE_SIZE, sort, dir);
  return json({ batches, total, page, pageSize: PAGE_SIZE, sort, dir });
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const columns = '1.4fr 1.2fr 1.1fr 1.1fr 60px';

type BatchRow = ReturnType<typeof useLoaderData<typeof loader>>['batches'][number];

const SortableHeader: FC<{ label: string; sortKey: SortKey; activeSort: SortKey; dir: SortDir; href: string }> = ({
  label,
  sortKey,
  activeSort,
  dir,
  href,
}) => {
  const isActive = activeSort === sortKey;
  return (
    <Link to={href} style={{ textDecoration: 'none' }}>
      <Flex align="center" gap="4px" color={isActive ? 'ink.text' : 'ink.textFaint'} _hover={{ color: 'ink.text' }}>
        <Text>{label}</Text>
        {isActive && <Icon as={dir === 'asc' ? MdArrowUpward : MdArrowDownward} boxSize="12px" />}
      </Flex>
    </Link>
  );
};

const SessionRow: FC<{ batch: BatchRow; onRequestCancel: (batch: BatchRow) => void }> = ({
  batch,
  onRequestCancel,
}) => {
  const navigate = useNavigate();
  const archiveFetcher = useFetcher();
  const primarySession = batch.sessions[0];
  const isLive = LIVE_PHASES.includes(batch.phase);
  const isArchivable = batch.phase === BatchPhase.COMPLETED || batch.phase === BatchPhase.CANCELED;
  const needsAttention = batchNeedsAttention(batch);

  return (
    <Grid
      templateColumns={columns}
      minW="640px"
      px="20px"
      py="16px"
      alignItems="center"
      borderBottom="1px solid"
      borderColor="ink.divider"
      cursor="pointer"
      _hover={{ bg: 'ink.cardHover' }}
      onClick={() => navigate(`/sessions/${primarySession?.id ?? ''}`)}
    >
      <Text fontSize="13px" fontWeight="700">
        {batch.name}
      </Text>
      <Flex align="center" gap="8px" fontSize="13px">
        <Box w="7px" h="7px" borderRadius="full" bg="brand.500" />
        {primarySession?.device?.name || 'Unknown'}
      </Flex>
      <Flex align="center" gap="6px">
        <Box
          as="span"
          fontSize="11px"
          fontWeight="700"
          px="9px"
          py="3px"
          borderRadius="6px"
          bg={`oklch(${phaseAccent(batch.phase)} / 0.18)`}
          color={`oklch(${phaseAccent(batch.phase)})`}
        >
          {phaseLabel(batch.phase)}
        </Box>
        {needsAttention && (
          <Tooltip label="Needs your input to continue" fontSize="12px">
            <Flex>
              <Icon as={MdWarning} boxSize="15px" color="orange.400" />
            </Flex>
          </Tooltip>
        )}
      </Flex>
      <Box>
        <Text fontSize="13px" fontWeight="600">
          {formatDate(batch.createdAt)}
        </Text>
        <Text fontSize="11px" color="ink.textFaint">
          {formatTime(batch.createdAt)}
        </Text>
      </Box>
      <Flex justify="flex-end" onClick={(e) => e.stopPropagation()}>
        {(isLive || isArchivable) && (
          <Menu placement="bottom-end">
            <MenuButton
              as={IconButton}
              aria-label="Session actions"
              icon={<Icon as={MdMoreVert} boxSize="18px" />}
              variant="ghost"
              size="sm"
            />
            <Portal>
              <MenuList>
                {isLive && (
                  <MenuItem icon={<Icon as={MdCancel} />} color="danger.500" onClick={() => onRequestCancel(batch)}>
                    Cancel Session
                  </MenuItem>
                )}
                {isArchivable && (
                  <MenuItem
                    icon={<Icon as={MdArchive} />}
                    isDisabled={archiveFetcher.state !== 'idle'}
                    onClick={() =>
                      archiveFetcher.submit(
                        { intent: 'archive' },
                        { method: 'post', action: `/api/batches/${batch.id}`, encType: 'application/json' },
                      )
                    }
                  >
                    Archive
                  </MenuItem>
                )}
              </MenuList>
            </Portal>
          </Menu>
        )}
      </Flex>
    </Grid>
  );
};

export default function SessionsPage() {
  const { batches, total, page, pageSize, sort, dir } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const cancelFetcher = useFetcher();
  const [cancelTarget, setCancelTarget] = useState<{ id: number; name: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  const pageHref = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    return `?${params.toString()}`;
  };

  const sortHref = (key: SortKey) => {
    const nextDir: SortDir = sort === key ? (dir === 'asc' ? 'desc' : 'asc') : DEFAULT_DIR[key];
    const params = new URLSearchParams(searchParams);
    params.set('sort', key);
    params.set('dir', nextDir);
    params.set('page', '1');
    return `?${params.toString()}`;
  };

  return (
    <>
      <Flex align="flex-end" justify="space-between" gap="16px" wrap="wrap">
        <Box>
          <Text fontSize="26px" fontWeight="700" letterSpacing="-0.3px">
            Brew Sessions
          </Text>
          <Text fontSize="14px" color="ink.textDim" mt="4px">
            History of all brewing sessions
          </Text>
        </Box>
        <Flex align="center" gap="12px">
          <Box
            fontSize="12px"
            fontWeight="700"
            px="12px"
            py="5px"
            borderRadius="999px"
            bg="brand.100"
            color="brand.500"
          >
            {total} Total
          </Box>
          <Link to="/sessions/new">
            <Button variant="brand" size="sm" leftIcon={<Icon as={MdAdd} />}>
              New Session
            </Button>
          </Link>
        </Flex>
      </Flex>

      <Card overflow="hidden" p="0">
        {batches.length === 0 ? (
          <Flex direction="column" align="center" gap="14px" py="64px">
            <Flex w="72px" h="72px" borderRadius="full" bg="brand.100" align="center" justify="center">
              <Icon as={MdHistory} boxSize="34px" color="brand.500" />
            </Flex>
            <Text fontSize="19px" fontWeight="700">
              No Sessions Yet
            </Text>
            <Text fontSize="14px" color="ink.textFaint" textAlign="center" maxW="380px">
              Start a brew on your Pico device and it will appear here with full history and logs
            </Text>
          </Flex>
        ) : (
          <>
            <Box overflowX="auto">
              <Grid
                templateColumns={columns}
                minW="640px"
                px="20px"
                py="14px"
                fontSize="11px"
                fontWeight="700"
                letterSpacing="0.5px"
                textTransform="uppercase"
                borderBottom="1px solid"
                borderColor="ink.divider"
              >
                <SortableHeader label="Recipe" sortKey="recipe" activeSort={sort} dir={dir} href={sortHref('recipe')} />
                <SortableHeader label="Device" sortKey="device" activeSort={sort} dir={dir} href={sortHref('device')} />
                <SortableHeader label="Status" sortKey="status" activeSort={sort} dir={dir} href={sortHref('status')} />
                <SortableHeader label="Date" sortKey="date" activeSort={sort} dir={dir} href={sortHref('date')} />
                <Box />
              </Grid>
              {batches.map((batch) => (
                <SessionRow
                  key={batch.id}
                  batch={batch}
                  onRequestCancel={(b) => setCancelTarget({ id: b.id, name: b.name })}
                />
              ))}
            </Box>

            <Flex align="center" justify="space-between" px="20px" py="14px" gap="12px" wrap="wrap">
              <Text fontSize="12px" color="ink.textFaint">
                Showing {rangeStart}–{rangeEnd} of {total}
              </Text>
              <Flex align="center" gap="8px">
                {page <= 1 ? (
                  <Button variant="outline" size="sm" leftIcon={<Icon as={MdChevronLeft} />} isDisabled>
                    Previous
                  </Button>
                ) : (
                  <Link to={pageHref(page - 1)}>
                    <Button variant="outline" size="sm" leftIcon={<Icon as={MdChevronLeft} />}>
                      Previous
                    </Button>
                  </Link>
                )}
                <Text fontSize="12px" color="ink.textSecondary" px="4px">
                  Page {page} of {totalPages}
                </Text>
                {page >= totalPages ? (
                  <Button variant="outline" size="sm" rightIcon={<Icon as={MdChevronRight} />} isDisabled>
                    Next
                  </Button>
                ) : (
                  <Link to={pageHref(page + 1)}>
                    <Button variant="outline" size="sm" rightIcon={<Icon as={MdChevronRight} />}>
                      Next
                    </Button>
                  </Link>
                )}
              </Flex>
            </Flex>
          </>
        )}
      </Card>

      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Cancel this session?</ModalHeader>
          <ModalBody>
            <Text fontSize="14px" color="ink.textSecondary">
              This stops {cancelTarget?.name} now and marks the session as canceled. This can&apos;t be undone.
            </Text>
          </ModalBody>
          <ModalFooter gap="10px">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep Session
            </Button>
            <Button
              variant="danger"
              isLoading={cancelFetcher.state !== 'idle'}
              onClick={() => {
                if (!cancelTarget) {
                  return;
                }
                cancelFetcher.submit(
                  { intent: 'endBatch' },
                  { method: 'post', action: `/api/batches/${cancelTarget.id}`, encType: 'application/json' },
                );
                setCancelTarget(null);
              }}
            >
              Cancel Session
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
