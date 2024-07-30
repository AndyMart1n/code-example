import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject } from 'rxjs';

import { PrepareDataService } from './prepare-data.service';
import { Timeslot } from '../models/models';
import {
  createTimeslotsForRepeatedDay,
  copyAllTimeslotsInDayToDays,
  getTimeslotWeekDays,
  copyTimeslotToDays,
  timeslotsForDay,
  createTimeslot,
  updateTimeslot,
  deleteTimeslot
} from '../gql/timeslot-consts';

@Injectable({
  providedIn: 'root'
})
export class TimeslotService {
  private timeslots: any[] = [];

  public onTimeslotsChanged: BehaviorSubject<any[]> = new BehaviorSubject([]);

  constructor(private prepareService: PrepareDataService, private apollo: Apollo) {
  }

  getTimeslotsForDay(scheduleId, day, onlyCheck = false, silent = false) {
    return new Promise<any[]>((resolve, reject) => {
      this.apollo.query({
        query: timeslotsForDay,
        variables: { scheduleId, day }
      })
        .subscribe(
          (data: any) => {
            if (!onlyCheck) {
              if (data.data.timeslotsForDay) {
                this.timeslots = data.data.timeslotsForDay.map((timeslot) => {
                  if (timeslot.repeatOf) {
                    timeslot.repeatOf = this.addTimeslotArtworks(timeslot.repeatOf);

                    return timeslot;
                  }

                  return this.addTimeslotArtworks(timeslot);
                });

                if (!silent) {
                  this.onTimeslotsChanged.next(this.timeslots);
                }
              }

              resolve(this.timeslots);
            } else {
              resolve(data.data.timeslotsForDay);
            }
          },
          (error) => {
            console.log(error);
            reject(error);
          }
        );
    });
  }

  createTimeslotsForRepeatedDay(scheduleId, day) {
    return new Promise<any>((resolve, reject) => {
      if (this.timeslots.some(item => item.repeatOf)) {
        this.apollo.mutate({
          mutation: createTimeslotsForRepeatedDay,
          variables: {
            scheduleId,
            day
          }
        })
          .subscribe(
            (data: any) => {
              if (data.data.createTimeslotsForRepeatedDay) {
                this.timeslots = data.data.createTimeslotsForRepeatedDay.map(timeslot => {
                  if (timeslot.repeatOf) {
                    timeslot.repeatOf = this.addTimeslotArtworks(timeslot.repeatOf);

                    return timeslot;
                  }

                  return this.addTimeslotArtworks(timeslot);
                });
                this.onTimeslotsChanged.next(this.timeslots);
              }

              resolve(data.data.createTimeslotsForRepeatedDay);
            },
            (error) => {
              console.log(error);
              reject(error);
            }
          );
      } else {
        resolve(true);
      }
    });
  }

  createTimeslot(scheduleId, day, from, to, playlistId, bucketId) {
    return new Promise<any[]>((resolve, reject) => {
      this.apollo.mutate({
        mutation: createTimeslot,
        variables: { scheduleId, day, from, to, playlistId, bucketId }
      })
        .subscribe(
          (data: any) => {
            if (data.data.createTimeslot) {
              const timeslot = this.addTimeslotArtworks(data.data.createTimeslot);

              this.timeslots.push(timeslot);
              this.onTimeslotsChanged.next(this.timeslots);
            }

            resolve(this.timeslots);
          },
          (error) => {
            console.log(error);
            reject(error);
          }
        );
    });
  }

  updateTimeslot(id, values) {
    return new Promise<any[]>((resolve, reject) => {
      this.apollo.mutate({
        mutation: updateTimeslot,
        variables: { id, values }
      })
        .subscribe(
          (data: any) => {
            this.timeslots = this.timeslots.map(item => {
              if (item.id === id) {
                return this.addTimeslotArtworks(data.data.updateTimeslot);
              }

              return item;
            });

            this.onTimeslotsChanged.next(this.timeslots);

            resolve(this.timeslots);
          },
          (error) => {
            console.log(error);
            reject(error);
          }
        );
    });
  }

  deleteTimeslot(id) {
    return new Promise<any[]>((resolve, reject) => {
      this.apollo.mutate({
        mutation: deleteTimeslot,
        variables: { id }
      })
        .subscribe(
          (data: any) => {
            if (data.data.deleteTimeslot) {
              this.timeslots = this.filterTimeslots(id);
              this.onTimeslotsChanged.next(this.timeslots);
            }

            resolve(this.timeslots);
          },
          (error) => {
            console.log(error);
            reject(error);
          }
        );
    });
  }

  repeatTimeslot(id, daysOfWeek, from, to, isRemove = false) {
    return new Promise<any[]>((resolve, reject) => {
      this.apollo.mutate({
        mutation: copyTimeslotToDays,
        variables: { id, daysOfWeek, from, to }
      })
        .subscribe(
          (data: any) => {
            if (isRemove) {
              this.timeslots = this.filterTimeslots(id);
              this.onTimeslotsChanged.next(this.timeslots);
            }

            resolve(this.timeslots);
          },
          (error) => {
            console.log(error);
            reject(error);
          }
        );
    });
  }

  repeatDay(scheduleId, day, daysOfWeek, from, to) {
    return new Promise<any[]>((resolve, reject) => {
      this.apollo.mutate({
        mutation: copyAllTimeslotsInDayToDays,
        variables: {
          scheduleId,
          day,
          daysOfWeek,
          from,
          to
        }
      })
        .subscribe(
          (data: any) => {
            resolve(this.timeslots);
          },
          (error) => {
            console.log(error);
            reject(error);
          }
        );
    });
  }

  getTimeslotWeekDays(id) {
    return new Promise<any>((resolve, reject) => {
      this.apollo.query({
        query: getTimeslotWeekDays,
        variables: {
          id
        }
      })
        .subscribe(
          (data: any) => {
            resolve(data.data.timeslot);
          },
          (error) => {
            console.log(error);
            reject(error);
          }
        );
    });
  }

  filterTimeslots(id) {
    return this.timeslots.filter(
      item => item.id && item.id !== id ||
        item.repeatOf && item.repeatOf.id !== id
    );
  }

  addTimeslotArtworks(timeslot: Timeslot) {
    if (timeslot.playlist) {
      timeslot.playlist.artwork = this.prepareService.playlistArtwork(timeslot.playlist);
    }

    if (timeslot.bucket) {
      timeslot.bucket.artwork = this.prepareService.bucketArtwork(timeslot.bucket);
    }

    return timeslot;
  }


}
