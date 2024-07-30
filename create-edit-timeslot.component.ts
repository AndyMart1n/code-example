import { Component, OnInit, Inject, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { NgScrollbar } from 'ngx-scrollbar';
import { Subscription } from 'rxjs';
import * as moment from 'moment';
import { debounce } from 'lodash';

import { Timeslot, Bucket, Playlist } from 'src/app/shared/models/models';
import { TimeslotService } from 'src/app/shared/services/timeslot.service';
import { BucketService } from 'src/app/shared/services/bucket.service';
import { PlaylistService } from 'src/app/shared/services/playlist.service';
import { ScheduleService } from 'src/app/shared/services/schedule.service';
import { PLAYLIST, BUCKET } from 'src/app/shared/constants/tracks-container-type';

interface DialogData {
  timeslot?: Timeslot;
  selectedDate: moment.Moment;
}

interface TracksContainerData {
  id: number;
  type: typeof PLAYLIST | typeof BUCKET;
}

@Component({
  templateUrl: './create-edit-timeslot.component.html',
  styleUrls: ['./create-edit-timeslot.component.scss']
})
export class CreateEditTimeslotComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput: ElementRef;

  private playlistsSub: Subscription;
  private bucketsSub: Subscription;

  public tracksContainerType: typeof PLAYLIST | typeof BUCKET;
  public initialSelectedTracksContainer: TracksContainerData;
  public selectedTracksContainer: TracksContainerData;
  public form: FormGroup;
  public playlists: Playlist[] = [];
  public filteredPlaylists: Playlist[] = [];
  public buckets: Bucket[] = [];
  public filteredBuckets: Bucket[] = [];
  public isLoading = false;
  public hours = this.getHours();
  public minutes = this.getMinutes();

  constructor(
    public dialogRef: MatDialogRef<CreateEditTimeslotComponent>,
    private timeslotService: TimeslotService,
    private bucketService: BucketService,
    private playlistsService: PlaylistService,
    private scheduleService: ScheduleService,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  ngOnInit() {
    this.form = new FormGroup({
      timeslotFromHours: new FormControl('09', [Validators.required]),
      timeslotFromMinutes: new FormControl('00', [Validators.required]),
      timeslotToHours: new FormControl('10', [Validators.required]),
      timeslotToMinutes: new FormControl('00', [Validators.required]),
    });

    if (this.data.timeslot) {
      const timeslot = this.data.timeslot;
      const [timeslotFromHours, timeslotFromMinutes] = timeslot.from.split(':');
      const [timeslotToHours, timeslotToMinutes] = timeslot.to.split(':');

      this.form.setValue({
        timeslotFromHours: timeslotFromHours,
        timeslotFromMinutes: timeslotFromMinutes,
        timeslotToHours: timeslotToHours,
        timeslotToMinutes: timeslotToMinutes
      });

      if (timeslot.bucket) {
        this.initialSelectedTracksContainer = this.selectedTracksContainer = {
          id: timeslot.bucket.id,
          type: BUCKET
        };

        this.selectTracksContainerType(BUCKET);
      } else {
        this.initialSelectedTracksContainer = this.selectedTracksContainer = {
          id: timeslot.playlist.id,
          type: PLAYLIST
        };

        this.selectTracksContainerType(PLAYLIST);
      }
    } else {
      this.selectTracksContainerType(PLAYLIST);
    }
  }

  selectTracksContainerType(tracksContainerType: typeof PLAYLIST | typeof BUCKET) {
    this.tracksContainerType = tracksContainerType;
    this.searchInput.nativeElement.value = '';
    this.isLoading = true;

    if (this.tracksContainerType === PLAYLIST) {
      this.searchTracksContainers = debounce(this.searchPlaylists, 500);
      this.fetchPlaylists().then(() => this.isLoading = false);
    } else {
      this.searchTracksContainers = debounce(this.searchBuckets, 500);
      this.fetchBuckets().then(() => this.isLoading = false);
    }
  }

  fetchPlaylists() {
    return this.playlistsService.getPlaylists().then(() => {
      this.playlistsSub = this.playlistsService.onPlaylistsChanged.subscribe((playlists) => {
        this.filteredPlaylists = this.playlists = playlists;
      });
    });
  }

  fetchBuckets() {
    return this.bucketService.getBuckets().then(() => {
      this.bucketsSub = this.bucketService.onBucketsChanged.subscribe((buckets) => {
        this.filteredBuckets = this.buckets = buckets;
      });
    });
  }

  saveTimeslot() {
    if (this.isFormValid()) {
      const timeslot: any = {
        from: `${this.form.value.timeslotFromHours}:${this.form.value.timeslotFromMinutes}`,
        to: `${this.form.value.timeslotToHours}:${this.form.value.timeslotToMinutes}`
      };

      if (this.data.timeslot) {
        if (this.selectedTracksContainer.type === PLAYLIST) {
          timeslot.playlistId = this.selectedTracksContainer.id;
        }

        if (this.selectedTracksContainer.type === BUCKET) {
          timeslot.bucketId = this.selectedTracksContainer.id;
        }

        this.timeslotService.updateTimeslot(this.data.timeslot.id, timeslot)
          .then(() => {
            this.dialogRef.close();
          });
      } else {
        const scheduleId = this.scheduleService.getSelectedScheduleId('clonedScheduleId');
        const selectedDate = this.data.selectedDate.format('YYYY-MM-DD');

        this.timeslotService.createTimeslotsForRepeatedDay(
          scheduleId,
          selectedDate
        ).then(() => {
          return this.timeslotService.createTimeslot(
            scheduleId,
            selectedDate,
            timeslot.from,
            timeslot.to,
            this.selectedTracksContainer.type === PLAYLIST ? this.selectedTracksContainer.id : 0,
            this.selectedTracksContainer.type === BUCKET ? this.selectedTracksContainer.id : 0
          );
        }).then(() => {
          this.dialogRef.close();
        });
      }
    }
  }

  isFormValid() {
    return this.form.valid && this.selectedTracksContainer && this.isTimerangeValid();
  }

  isTimerangeValid() {
    const from = `${this.form.value.timeslotFromHours}${this.form.value.timeslotFromMinutes}`;
    const to = `${this.form.value.timeslotToHours}${this.form.value.timeslotToMinutes}`;

    return Number(from) < Number(to);
  }

  selectHours(hours, hoursOf) {
    this.form.patchValue({
      [hoursOf === 'from' ? 'timeslotFromHours' : 'timeslotToHours']: hours
    });
  }

  selectMinutes(minutes, minutesOf) {
    this.form.patchValue({
      [minutesOf === 'from' ? 'timeslotFromMinutes' : 'timeslotToMinutes']: minutes
    });
  }

  searchTracksContainers(term: string) {
    // will be defined in runtime
  }

  searchPlaylists(term: string) {
    if (term === '') {
      this.filteredPlaylists = this.playlists;
    } else {
      this.filteredPlaylists = this.playlists.filter((playlist) => {
        return playlist.name.toLowerCase().includes(term.toLowerCase());
      });
    }
  }

  searchBuckets(term: string) {
    if (term === '') {
      this.filteredBuckets = this.buckets;
    } else {
      this.filteredBuckets = this.buckets.filter((bucket) => {
        return bucket.name.toLowerCase().includes(term.toLowerCase());
      });
    }
  }

  selectTracksContainer(id: number, type: typeof PLAYLIST | typeof BUCKET) {
    this.selectedTracksContainer = { id, type };
  }

  getHours() {
    const MAX_HOURS = 23;
    const MIN_TWO_DIGIT_VALUE = 10;
    const hours: string[] = [];

    for (let i = 0; i < MIN_TWO_DIGIT_VALUE; i++) { hours.push('0' + i); }

    for (let i = MIN_TWO_DIGIT_VALUE; i <= MAX_HOURS; i++) { hours.push('' + i); }

    return hours;
  }

  getMinutes() {
    const MAX_MINUTES = 59;
    const MIN_TWO_DIGIT_VALUE = 10;
    const minutes: string[] = [];

    for (let i = 0; i < MIN_TWO_DIGIT_VALUE; i++) { minutes.push('0' + i); }

    for (let i = MIN_TWO_DIGIT_VALUE; i <= MAX_MINUTES; i++) { minutes.push('' + i); }

    return minutes;
  }

  onTimeMenuOpened(hourMenuScrollbarRef: NgScrollbar, hourEl: string, minuteMenuScrollbarRef: NgScrollbar, minuteEl: string) {
    hourMenuScrollbarRef.scrollToElement(hourEl);
    minuteMenuScrollbarRef.scrollToElement(minuteEl);
  }

  ngOnDestroy() {
    if (this.playlistsSub) {
      this.playlistsSub.unsubscribe();
    }

    if (this.bucketsSub) {
      this.bucketsSub.unsubscribe();
    }
  }
}
