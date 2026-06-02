<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\IntroSystemSyncService;

class SyncLeadsFromIntro extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'leads:sync-intro {--limit=100 : The number of history records to sync}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync leads and introductory lectures directly from the external intro website';

    /**
     * Execute the console command.
     */
    public function handle(IntroSystemSyncService $syncService)
    {
        $this->info('Starting leads synchronization from the introductory lectures system...');
        
        $limit = (int) $this->option('limit');
        $this->line("History limit set to: {$limit}");

        $results = $syncService->sync($limit);

        $this->newLine();
        $this->info('Synchronization Completed!');
        $this->line("<fg=cyan>Upcoming lectures scraped:</> {$results['scraped_upcoming']}");
        $this->line("<fg=cyan>History lectures scraped:</> {$results['scraped_history']}");
        $this->line("<fg=green>New leads imported:</> {$results['imported']}");
        $this->line("<fg=yellow>Existing leads updated:</> {$results['updated']}");

        if (!empty($results['errors'])) {
            $this->newLine();
            $this->error('The following errors occurred during the sync:');
            foreach ($results['errors'] as $error) {
                $this->line("- {$error}");
            }
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}
