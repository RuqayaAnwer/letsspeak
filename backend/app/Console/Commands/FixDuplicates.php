<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Lead;

class FixDuplicates extends Command
{
    protected $signature = "leads:fix-duplicates";
    protected $description = "Removes duplicate leads that were accidentally imported today.";

    public function handle()
    {
        $this->info("Looking for duplicates...");
        
        // Find phones that appear more than once
        $duplicates = Lead::select("phone_whatsapp")
            ->groupBy("phone_whatsapp")
            ->havingRaw("COUNT(*) > 1")
            ->pluck("phone_whatsapp");
            
        $this->info("Found " . $duplicates->count() . " duplicated phone numbers.");
        
        $deleted = 0;
        $bar = $this->output->createProgressBar($duplicates->count());
        
        foreach ($duplicates as $phone) {
            // Get all leads with this phone, ordered by created_at ascending (oldest first)
            $leads = Lead::where("phone_whatsapp", $phone)->orderBy("created_at", "asc")->get();
            
            if ($leads->count() > 1) {
                // Keep the first one (the oldest), delete the rest
                $oldest = $leads->first();
                foreach ($leads as $lead) {
                    if ($lead->id !== $oldest->id) {
                        $lead->delete();
                        $deleted++;
                    }
                }
            }
            $bar->advance();
        }
        
        $bar->finish();
        $this->newLine();
        $this->info("Successfully deleted $deleted duplicate leads.");
    }
}

