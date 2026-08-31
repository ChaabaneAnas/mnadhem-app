'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
    ExternalLink,
    FileText,
    MoreHorizontal,
    Printer,
    Truck,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useErrorMessage } from '@/lib/api-error';
import {
    canCancel,
    canGenerateAwb,
    canPrintLabel,
    canRequestPickup,
    canTrack
} from '@/lib/order-status';
import { getTrackingUrl } from '../actions';
import type { Order } from './types';
import type { FulfillmentAction } from './use-fulfillment';

/**
 * Per-row actions, replacing the single Cancel link the column used to hold.
 *
 * Which entries appear is driven entirely by the order's status, so an action
 * the backend would refuse is never offered — the safeguards in spec section
 * 4.D still run server-side, but a merchant should not have to discover them by
 * clicking.
 */
export function OrderRowActions({
    order,
    onRun,
    onCancel,
    disabled
}: {
    order: Order;
    onRun: (action: FulfillmentAction, orderIds: string[]) => void;
    onCancel: (order: Order) => void;
    disabled: boolean;
}) {
    const t = useTranslations('orders');
    const getError = useErrorMessage();
    const [tracking, startTracking] = useTransition();
    const [open, setOpen] = useState(false);

    const showAwb = canGenerateAwb(order.status);
    const showPrint = canPrintLabel(order.status) && order.shipment !== null;
    const showPickup = canRequestPickup(order.status);
    const showTrack = canTrack(order.status) && order.shipment !== null;
    const showCancel = canCancel(order.status);

    // Every terminal status lands here; rendering an empty menu button would
    // suggest there is something to click.
    if (!showAwb && !showPrint && !showPickup && !showTrack && !showCancel) {
        return null;
    }

    /**
     * Resolved on demand rather than embedded in every row: the URL comes from
     * the carrier provider, and fetching one per row would mean a query per order
     * on every page load.
     */
    function openTracking() {
        startTracking(async () => {
            try {
                const { url } = await getTrackingUrl(order.id);
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                else toast({ variant: 'default', title: t('noTrackingUrl') });
            } catch (err) {
                toast({ variant: 'destructive', title: getError(err) });
            }
        });
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('colActions')}
                    className="text-muted-foreground"
                >
                    <MoreHorizontal size={15} />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-44">
                {showAwb && (
                    <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() => onRun('awb', [order.id])}
                    >
                        <FileText />
                        {t('generateAwb')}
                    </DropdownMenuItem>
                )}
                {showPrint && (
                    <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() => onRun('print', [order.id])}
                    >
                        <Printer />
                        {t('printLabel')}
                    </DropdownMenuItem>
                )}
                {showPickup && (
                    <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() => onRun('pickup', [order.id])}
                    >
                        <Truck />
                        {t('requestPickup')}
                    </DropdownMenuItem>
                )}
                {showTrack && (
                    <DropdownMenuItem
                        disabled={tracking}
                        onSelect={openTracking}
                    >
                        <ExternalLink />
                        {t('trackPackage')}
                    </DropdownMenuItem>
                )}

                {showCancel &&
                    (showAwb || showPrint || showPickup || showTrack) && (
                        <DropdownMenuSeparator />
                    )}
                {showCancel && (
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onCancel(order)}
                    >
                        <X />
                        {t('cancel')}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
